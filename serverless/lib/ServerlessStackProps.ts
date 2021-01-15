import lambda = require('@aws-cdk/aws-lambda')

export interface ServerlessStackProps{
    restApiName?: string
    apiPath?: string
    stageName?: string
    ddbTableName?: string
    ddbPartitionKey?: string
    lambdaSrc?: string
    lambdaHandler?: string
    lambdaRuntime?: lambda.Runtime
    lambdaEnvVariables?: JSON
}