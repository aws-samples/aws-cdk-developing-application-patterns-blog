import core = require ('@aws-cdk/core')
import kms = require('@aws-cdk/aws-kms')
import cwlogs = require('@aws-cdk/aws-logs')
import autoscaling = require('@aws-cdk/aws-autoscaling')
import elb = require('@aws-cdk/aws-elasticloadbalancingv2')
import ec2 = require('@aws-cdk/aws-ec2')
import secretsmanager = require('@aws-cdk/aws-secretsmanager')
import rds = require('@aws-cdk/aws-rds')
import iam = require('@aws-cdk/aws-iam')
const fs = require('fs-extra')
import path = require('path')
import { TraditionalStackProps } from './TraditionalStackProps'
import { Duration } from '@aws-cdk/core'

export class TraditionalInfrastructureStack extends core.Stack {
    public readonly KmsKey : kms.Key
    public readonly CfnVpc: ec2.Vpc
    public readonly ALBSecurityGroup: ec2.SecurityGroup
    public readonly EC2SecurityGroup: ec2.SecurityGroup
    public readonly RDSSecurityGroup: ec2.SecurityGroup
    public readonly CfnLaunchConfiguration: autoscaling.CfnLaunchConfiguration
    public readonly CfnAutoScalingGroup: autoscaling.CfnAutoScalingGroup
    public readonly CfnLoadBalancer: elb.CfnLoadBalancer
    public readonly CfnDefaultALBTargetGroup: elb.CfnTargetGroup
    public readonly CfnALBDefaultListener: elb.CfnListener
    public readonly CfnALBDefaultListenerRule: elb.CfnListenerRule
    public readonly Secret: secretsmanager.Secret
    public readonly RDSClusterParameterGroup: rds.ParameterGroup
    public readonly RDSDbCluster: rds.DatabaseCluster
    public readonly IAMRole: iam.Role
    public readonly VpcFlowLogGroup: cwlogs.LogGroup

    private readonly matcherHttpCode = '200-299'
    private readonly elbTgHealthCheckPath = '/elb'
    private readonly defaultLBScheme = 'internet-facing'
    private readonly defaultLBPort = 80
    private readonly defaultLBProtocol = 'HTTP'
    private readonly defaultListenerActionType = 'forward'
    private readonly defaultASGCapacity = 1
    private readonly secretStoreParamName = 'RDSDBSecret'
    private readonly secretUsername = 'root'
    private readonly secretPasswordKey = 'password'
    private readonly rdsPasswordLength = 16
    private readonly rdsBackupRetentionDays = 7

    /**
     * Class constructor.
     * @param scope  The construct within which this construct is defined.
     * @param id     unique identifier for the construct.
     * @param props  Properties of the construct.
     */
    constructor(scope: core.Construct, id: string, props: TraditionalStackProps) {
        super(scope, id)

        // Create Kms key for the traditional stack 
        this.KmsKey = new kms.Key(this, 'TraditionalStackKmsKey', {
            enableKeyRotation: true,
            alias:'TraditionalStackKmsKey',
            removalPolicy: core.RemovalPolicy.DESTROY
          });

        // Create a new VPC
        this.VpcFlowLogGroup = new cwlogs.LogGroup(this, "VPCFlowLogs", { removalPolicy: core.RemovalPolicy.DESTROY });
        const role = new iam.Role(this, 'VpcFlowLogRole', {
            assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com')
        });
        this.CfnVpc = this.addVpc(props)
        this.CfnVpc.addFlowLog('FlowLog', {
            destination: ec2.FlowLogDestination.toCloudWatchLogs(this.VpcFlowLogGroup, role)
        })
        this.CfnVpc.publicSubnets.forEach(element => {
            let subnet = element.node.defaultChild as ec2.CfnSubnet
            subnet.mapPublicIpOnLaunch = false
        });

        // Create Security group for AWS resources
        this.ALBSecurityGroup = this.createALBSecurityGroup()
        this.EC2SecurityGroup = this.createEC2SecurityGroup()
        this.RDSSecurityGroup = this.createRDSSecurityGroup()

        // Create load balancer in the above created VPC
        this.CfnLoadBalancer = this.addLoadBalancer(props)

        // Create Target Groups for Load Balancer
        this.CfnDefaultALBTargetGroup = this.addDefaultTargetGroup(props)

        // Create secret for RDS DB instance
        this.Secret = this.addSecret(props)
        
        // Create RDS DB cluster
        this.RDSDbCluster = this.addRDSDbCluster(props)

        // Create IAM Role for EC2 instance
        this.IAMRole = this.addIAMRole()

        // Create auto scaling group - Launch Configuration
        this.CfnLaunchConfiguration = this.addLaunchConfiguration(props)

        // Waiting for VPC creation to complete
        this.CfnLaunchConfiguration.node.addDependency(this.CfnVpc)

        // Create auto scaling group in above created VPC
        this.CfnAutoScalingGroup = this.addAutoScalingGroup(props)

        // Add a default listener to Application Load Balancer
        this.CfnALBDefaultListener = this.addDefaultListener()

        // Add listener rules to Application Load Balancer 
        this.CfnALBDefaultListenerRule = this.addDefaultListenerRule()

        // Add Outputs to CloudFormation stack
        this.addOutputsToCloudFormationTemplate()
    }

    /**
     * Function to add VPC resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns VPC resource.
     */
    private addVpc(props: TraditionalStackProps): ec2.Vpc {
        return new ec2.Vpc(this, 'VPC', {
            cidr: props.vpcCidr,
            subnetConfiguration: [{
                name: 'LoadBalancer',
                subnetType: ec2.SubnetType.PUBLIC
            }, {
                name: 'Application',
                subnetType: ec2.SubnetType.PRIVATE
            }, {
                name: 'Database',
                subnetType: ec2.SubnetType.ISOLATED
            }]
        })
    }

    /**
     * Function to add ALB Security Group resource to CloudFormation stack.
     * @returns Security Group resource.
     */
    private createALBSecurityGroup(): ec2.SecurityGroup {
        var securityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
            vpc: this.CfnVpc,
            allowAllOutbound: false
        })
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443))
        this.CfnVpc.privateSubnets.forEach(element => {
            securityGroup.addEgressRule(ec2.Peer.ipv4(element.ipv4CidrBlock), ec2.Port.tcp(80))
        });
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443))
        return securityGroup
    }

    /**
     * Function to add EC2 Security Group resource to CloudFormation stack.
     * @returns Security Group resource.
     */
    private createEC2SecurityGroup(): ec2.SecurityGroup {
        var securityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
            vpc: this.CfnVpc,
            allowAllOutbound: false
        })
        this.CfnVpc.publicSubnets.forEach(element => {
            securityGroup.addIngressRule(ec2.Peer.ipv4(element.ipv4CidrBlock), ec2.Port.tcp(80))
        });
        this.CfnVpc.isolatedSubnets.forEach(element => {
            securityGroup.addEgressRule(ec2.Peer.ipv4(element.ipv4CidrBlock), ec2.Port.tcp(3306))
        });
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443))
        return securityGroup
    }

    /**
     * Function to add RDS Security Group resource to CloudFormation stack.
     * @returns Security Group resource.
     */
    private createRDSSecurityGroup(): ec2.SecurityGroup {
        var securityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
            vpc: this.CfnVpc,
            allowAllOutbound: false
        })
        this.CfnVpc.privateSubnets.forEach(element => {
            securityGroup.addIngressRule(ec2.Peer.ipv4(element.ipv4CidrBlock), ec2.Port.tcp(3306))
            securityGroup.addEgressRule(ec2.Peer.ipv4(element.ipv4CidrBlock), ec2.Port.allTcp())
        });
        return securityGroup
    }

    /**
     * Function to add IAM Role resource to CloudFormation stack.
     * @returns Security Group resource.
     */
    private addIAMRole(): iam.Role {
        var iamRole =  new iam.Role(this, 'EC2IAMRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        })
        iamRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "secretsmanager:GetSecretValue",
                "kms:Decrypt",
                "kms:Encrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*"
            ],
            resources: [
                this.Secret.secretArn,
                this.KmsKey.keyArn
            ]
        }))
        return iamRole
    }

    /**
     * Function to add Application Load Balancer resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Load Balancer (ELB v2) resource.
     */
    private addLoadBalancer(props: TraditionalStackProps): elb.CfnLoadBalancer {
        const publicSubnets = this.CfnVpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC})
        return new elb.CfnLoadBalancer(this, 'LoadBalancer', {
            subnets: publicSubnets.subnetIds,
            scheme: (props.lbScheme) ? props.lbScheme : this.defaultLBScheme,
            securityGroups: [this.ALBSecurityGroup.securityGroupId]
        })
    }

    /**
     * Function to add a default Target Group resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Load Balancer Target Group (for root level API) resource.
     */
    private addDefaultTargetGroup(props: TraditionalStackProps): elb.CfnTargetGroup {
        return new elb.CfnTargetGroup(this, 'LBDefaultTargetGroup', {
            healthCheckPath: (props.elbHealthCheckPath) ? props.elbHealthCheckPath : this.elbTgHealthCheckPath,
            matcher: {
                httpCode: this.matcherHttpCode
            },
            port: this.defaultLBPort,
            protocol: this.defaultLBProtocol,
            vpcId: this.CfnVpc.vpcId
        })
    }

    /**
     * Function to add Load Balancer Listener resource to CloudFormation stack.
     * @returns Load Balancer Listener resource.
     */
    private addDefaultListener(): elb.CfnListener {
        return new elb.CfnListener(this, 'HTTPDefaultListener', {
            defaultActions: [{
                targetGroupArn: this.CfnDefaultALBTargetGroup.ref,
                type: this.defaultListenerActionType
            }],
            loadBalancerArn: this.CfnLoadBalancer.ref,
            port: this.defaultLBPort,
            protocol: this.defaultLBProtocol
        })
    }

    /**
     * Function to add default Load Balancer Listener Rule resource to CloudFormation stack.
     * @returns Load Balancer Listener Rule (for root level API) resource.
     */
    private addDefaultListenerRule(): elb.CfnListenerRule {
        return new elb.CfnListenerRule(this, 'LBDefaultListenerRule', {
            listenerArn: this.CfnALBDefaultListener.ref,
            priority: 1,
            actions: [{
                type: this.defaultListenerActionType,
                targetGroupArn: this.CfnDefaultALBTargetGroup.ref
            }],
            conditions: [{
                field: 'path-pattern',
                values: ['*']
            }]
        })
    }

    /**
     * Function to add Launch Configuration resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Launch Configuration resource.
     */
    private addLaunchConfiguration(props: TraditionalStackProps): autoscaling.CfnLaunchConfiguration {
        let basePath:string = path.join(__dirname, '..')
        let userdataFilePath: string = path.join(basePath, 'scripts', 'userdata.sh')
        var userdataLoc = (props.userdata) ? props.userdata : userdataFilePath
        let userdata = fs.readFileSync(userdataLoc, 'utf8')

        return new autoscaling.CfnLaunchConfiguration(this, 'LaunchConfig', {
            imageId: (props.imageId) ? props.imageId : ec2.MachineImage.latestAmazonLinux().getImage(this).imageId,
            instanceType: props.instanceType,
            iamInstanceProfile: new iam.CfnInstanceProfile(this, "InstanceProfile", {roles: [this.IAMRole.roleName]}).attrArn,
            userData: ec2.UserData.custom(core.Fn.base64(core.Fn.sub(userdata, {
                "__RDS_HOST__": this.RDSDbCluster.clusterEndpoint.hostname,
                "__SECRETNAME__": (props.rdsSecretStoreParamName) ? props.rdsSecretStoreParamName : this.secretStoreParamName
            }))).render(),
            securityGroups: [this.EC2SecurityGroup.securityGroupId],
        })
    }

    /**
     * Function to add AWS Auto Scaling Group resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns AWS Auto Scaling Group resource.
     */
    private addAutoScalingGroup(props: TraditionalStackProps): autoscaling.CfnAutoScalingGroup {
        const privateSubnets = this.CfnVpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE})
        return new autoscaling.CfnAutoScalingGroup(this, 'AutoScalingGroup', {
            minSize: (props.asgMinSize) ? props.asgMinSize.toString() : this.defaultASGCapacity.toString(),
            maxSize: (props.asgMaxSize) ? props.asgMaxSize.toString() : this.defaultASGCapacity.toString(),
            desiredCapacity: (props.asgDesiredSize) ? props.asgDesiredSize.toString() : this.defaultASGCapacity.toString(),
            launchConfigurationName: this.CfnLaunchConfiguration.ref,
            vpcZoneIdentifier: privateSubnets.subnetIds,
            targetGroupArns: [
                this.CfnDefaultALBTargetGroup.ref
            ]
        })
    }

    /**
     * Function to add Secret to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns AWS Secrets Manager Secret resource.
     */
    private addSecret(props: TraditionalStackProps): secretsmanager.Secret {
        var rdsUsername: string = (props.rdsUsername) ? (props.rdsUsername) : this.secretUsername
        var rdsPasswordKey: string = (props.rdsPasswordKey) ? (props.rdsPasswordKey) : this.secretPasswordKey
        return new secretsmanager.Secret(this, 'TemplatedRDSSecret', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: rdsUsername }),
                generateStringKey: rdsPasswordKey,
                passwordLength: (props.rdsPasswordLength) ? (props.rdsPasswordLength) : this.rdsPasswordLength,
                excludeCharacters: '"@/\\'
            },
            secretName: (props.rdsSecretStoreParamName) ? props.rdsSecretStoreParamName : this.secretStoreParamName,
            encryptionKey:this.KmsKey
        })
    }

    /**
     * Function to add Secret to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns AWS Secrets Manager Secret resource.
     */
    private addRDSDbCluster(props: TraditionalStackProps): rds.DatabaseCluster {
        return new rds.DatabaseCluster(this, 'RDSDBCluster', {
            engine: (props.rdsEngine) ? props.rdsEngine : rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
            storageEncrypted:true,
            storageEncryptionKey:this.KmsKey,
            backup: {retention:Duration.days(this.rdsBackupRetentionDays)}, 
            credentials: {
                username: this.Secret.secretValueFromJson('username').toString(),
                password: this.Secret.secretValueFromJson('password')
            },
            instanceProps: {
                instanceType: (props.rdsInstanceType) ? props.rdsInstanceType : ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
                vpcSubnets: {
                    subnetType: ec2.SubnetType.ISOLATED
                },
                vpc: this.CfnVpc,
                securityGroups: [
                    this.RDSSecurityGroup
                ]
            }
        })
    }

    /**
     * Function to add Outputs to CloudFormation stack.
     * @returns
     */
    private addOutputsToCloudFormationTemplate() {
        new core.CfnOutput(this, 'ApiOutput', {
            value: "http://" + this.CfnLoadBalancer.getAtt('DNSName').toString()
        })
    }
}