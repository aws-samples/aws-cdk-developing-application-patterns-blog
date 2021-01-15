import ec2 = require('@aws-cdk/aws-ec2')
import rds = require('@aws-cdk/aws-rds')

export interface TraditionalStackProps{
    vpcCidr?: string
    lbScheme?: string
    elbHealthCheckPath?: string
    imageId?: string
    instanceType: string
    asgMinSize?: number
    asgMaxSize?: number
    asgDesiredSize?: number
    userdata?: string
    userdataEnvVars?: JSON
    rdsInstanceType?: ec2.InstanceType
    rdsEngine?: rds.IClusterEngine
    rdsEngineVersion?: rds.AuroraMysqlEngineVersion
    rdsSecretStoreParamName?: string
    rdsUsername?: string
    rdsPasswordKey?: string
    rdsPasswordLength?: number
}