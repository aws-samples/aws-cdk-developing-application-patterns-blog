import { Stack } from '@aws-cdk/core'
import { expect, haveResource, countResources, haveResourceLike } from '@aws-cdk/assert'
import '@aws-cdk/assert/jest'
import ec2 = require('@aws-cdk/aws-ec2')
import rds = require('@aws-cdk/aws-rds')

import { TraditionalInfrastructureStack } from '../lib/TraditionalStack'
import { TraditionalStackProps } from '../lib/TraditionalStackProps'

const stack = new Stack()
const props: TraditionalStackProps = {
    instanceType: 't2.micro'
}
const myStack = new TraditionalInfrastructureStack(stack, 'TestTraditionalStack', props)

// Fine-Grained Assertions and validation tests
test('VPC - VPC is created', () => {
    expect(myStack).to(haveResource('AWS::EC2::VPC'))
})

test('VPC - VPC has corect number of resources', () => {
    expect(myStack).to(countResources('AWS::EC2::Subnet', 6))
    expect(myStack).to(countResources('AWS::EC2::RouteTable', 6))
    expect(myStack).to(countResources('AWS::EC2::NatGateway', 2))
    expect(myStack).to(countResources('AWS::EC2::InternetGateway', 1))
})

test('VPC - VPC has a non-default security group for stack', () => {
    expect(myStack).to(haveResourceLike('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
            {"CidrIp":"10.0.64.0/19","Description":"from 10.0.64.0/19:ALL PORTS","FromPort":0,"IpProtocol":"tcp","ToPort":65535},
            {"CidrIp":"10.0.96.0/19","Description":"from 10.0.96.0/19:ALL PORTS","FromPort":0,"IpProtocol":"tcp","ToPort":65535}
        ],
        SecurityGroupIngress: [
            {"CidrIp":"10.0.64.0/19","Description":"from 10.0.64.0/19:3306","FromPort":3306,"IpProtocol":"tcp","ToPort":3306},
            {"CidrIp":"10.0.96.0/19","Description":"from 10.0.96.0/19:3306","FromPort":3306,"IpProtocol":"tcp","ToPort":3306}
        ],
        VpcId: {"Ref": "VPCB9E5F0B4"}
    }))
})

test('Application Load Balancer - Load balancer configuration is valid', () => {
    expect(myStack).to(countResources('AWS::ElasticLoadBalancingV2::TargetGroup', 1))
    expect(myStack).to(countResources('AWS::ElasticLoadBalancingV2::Listener', 1))
    expect(myStack).to(countResources('AWS::ElasticLoadBalancingV2::ListenerRule', 1))

    expect(myStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        SecurityGroups: [{ "Fn::GetAtt": ["ALBSecurityGroup29A3BDEF","GroupId"]}],
        Subnets: [{ "Ref": "VPCLoadBalancerSubnet1SubnetAB1D1113" }, { "Ref": "VPCLoadBalancerSubnet2SubnetF2231143"}],
        Scheme: "internet-facing"
    }))
    expect(myStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        HealthCheckPath: "/elb",
        Matcher: {"HttpCode": "200-299"},
        Port: 80,
        Protocol: "HTTP",
        VpcId: {"Ref": "VPCB9E5F0B4"}
    }))
    expect(myStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        DefaultActions: [{"TargetGroupArn": {"Ref": "LBDefaultTargetGroup"},"Type": "forward"}],
        LoadBalancerArn: {"Ref": "LoadBalancer"},
        Port: 80,
        Protocol: "HTTP"
    }))
})

test('Auto Scaling Group - Auto Scaling Group and its components are present', () => {
    expect(myStack).to(haveResourceLike('AWS::AutoScaling::LaunchConfiguration', {
        ImageId: {"Ref": "SsmParameterValueawsserviceamiamazonlinuxlatestamznamihvmx8664gp2C96584B6F00A464EAD1953AFF4B05118Parameter"},
        InstanceType: "t2.micro",
        SecurityGroups: [{ "Fn::GetAtt": ["EC2SecurityGroup05DEE054", "GroupId"]}]
    }))
    expect(myStack).to(haveResourceLike('AWS::AutoScaling::AutoScalingGroup', {
        LaunchConfigurationName: {"Ref": "LaunchConfig"},
        MaxSize: "1",
        MinSize: "1",
        DesiredCapacity: "1",
        TargetGroupARNs: [{"Ref": "LBDefaultTargetGroup"}],
        VPCZoneIdentifier: [{ "Ref": "VPCApplicationSubnet1SubnetCE118F80" }, { "Ref": "VPCApplicationSubnet2Subnet988E96B1"}]
    }))
})

test('Override default values - Overriding properties', () => {
    const stack = new Stack()
    const props: TraditionalStackProps = {
        vpcCidr: "172.16.0.0/16",
        rdsEngine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
        rdsInstanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        rdsSecretStoreParamName: "rdsSecret",
        rdsPasswordLength: 24,
        rdsUsername: 'admin',
        elbHealthCheckPath: "/index.html",
        rdsPasswordKey: 'password@2021',
        instanceType: 't2.micro',
        asgMaxSize: 4,
        asgMinSize: 2,
        asgDesiredSize: 3,
        imageId: 'ami-abcd1234',
        lbScheme: 'internal'
    }
    const myOverrideStack = new TraditionalInfrastructureStack(stack, 'TestTraditionalStack', props)
    expect(myOverrideStack).to(haveResourceLike('AWS::EC2::VPC', {CidrBlock: "172.16.0.0/16"}))
    expect(myOverrideStack).to(haveResourceLike('AWS::AutoScaling::LaunchConfiguration', {
        ImageId: "ami-abcd1234",
        InstanceType: "t2.micro",
        SecurityGroups: [{ "Fn::GetAtt": ["EC2SecurityGroup05DEE054", "GroupId"] }]
    }))
    expect(myOverrideStack).to(haveResourceLike('AWS::AutoScaling::AutoScalingGroup', {
        MaxSize: "4",
        MinSize: "2",
        DesiredCapacity: "3"
    }))
    expect(myOverrideStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Scheme: "internal"
    }))
})
