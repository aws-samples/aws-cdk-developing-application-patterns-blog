import * as core from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as serverless from 'serverless-infrastructure'

export class MyServerlessStack extends serverless.ServerlessInfrastructureStack {

    constructor(scope: core.Construct, id: string, props: serverless.ServerlessStackProps = {
                ddbTableName: "v2-DynamoDBTable",
                ddbPartitionKey: "v2ItemId",
                lambdaSrc: "src",
                lambdaHandler: "override-lambda-function.lambda_handler",
                lambdaRuntime: lambda.Runtime.NODEJS_16_X,
                lambdaEnvVariables: {
                    DYNAMODB_TABLE_NAME: "v2-DynamoDBTable",
                    PARTITION_KEY: "v2ItemId"
                }
            }) {
        super(scope, id, props)
    }
}
const app = new core.App()
new MyServerlessStack(app, 'ServerlessStack-v2')