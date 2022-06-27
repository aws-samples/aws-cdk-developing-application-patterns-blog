import core =require ('@aws-cdk/core')
import kms = require('@aws-cdk/aws-kms')
import cwlogs =  require('@aws-cdk/aws-logs')
import lambda = require('@aws-cdk/aws-lambda')
import dynamodb = require('@aws-cdk/aws-dynamodb')
import apigateway = require('@aws-cdk/aws-apigateway')
import { ServerlessStackProps } from './ServerlessStackProps'
import path = require('path')

export class ServerlessInfrastructureStack extends core.Stack {
    public readonly DynamoDBTable: dynamodb.Table
    public readonly LambdaFunction: lambda.Function
    public readonly RestApi: apigateway.RestApi
    public readonly Resource: apigateway.Resource
    public readonly LambdaIntegration: apigateway.LambdaIntegration
    public readonly ServerlessStackKmsKey : kms.Key
    public readonly ApigwAccessLogGroup : cwlogs.LogGroup

    /**
     * Class constructor.
     * @param scope  The construct within which this construct is defined.
     * @param id     unique identifier for the construct.
     * @param props  Properties of the construct.
     */
    constructor(scope: core.Construct, id: string, props: ServerlessStackProps) {
        super(scope, id)

        // Create Kms key for DynamoDB 
        this.ServerlessStackKmsKey = new kms.Key(this, 'ServerlessStackKmsKey', {
            enableKeyRotation: true,
            alias:'ServerlessStackKmsKey',
            removalPolicy: core.RemovalPolicy.DESTROY
          });

        //Create CW log group for Apigw access logs
        this.ApigwAccessLogGroup = new cwlogs.LogGroup(this, "ApigwAccessLogs", {removalPolicy: core.RemovalPolicy.DESTROY});

        
        // Create DynamoDB table
        this.DynamoDBTable = this.addDynamoDBTable(props)

        // Create a Lambda Function to read
        this.LambdaFunction = this.addLambdaFunction(props)

        // Create a new Rest API resource
        this.RestApi = this.addRestAPI(props)

        // Creates a resource in the API
        this.Resource = this.addResource(props)

        // Create Lambda Integration
        this.LambdaIntegration = this.createLambdaIntegration()
        this.Resource.addMethod('GET', this.LambdaIntegration)

        // Give Lambda function permission to read and write data in DynamoDB table
        this.DynamoDBTable.grantReadWriteData(this.LambdaFunction)

        // Add Outputs to CloudFormation stack
        this.addOutputsToCloudFormationTemplate()
    }

    /**
     * Function to add DynamoDB table resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns DynamoDB table resource.
     */
    private addDynamoDBTable(props: ServerlessStackProps): dynamodb.Table {
        var tableName = (props.ddbTableName) ? props.ddbTableName : 'dynamodb-table'
        var partitionKey = (props.ddbPartitionKey) ? props.ddbPartitionKey : 'itemId'


        return new dynamodb.Table(this, 'DynamoDBTable', {
            tableName: tableName,
            partitionKey: {
                name: partitionKey,
                type: dynamodb.AttributeType.STRING
            },
            removalPolicy: core.RemovalPolicy.DESTROY,
            encryptionKey:this.ServerlessStackKmsKey,
            pointInTimeRecovery:true
        })
    }

    /**
     * Function to add AWS Lambda Function resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Lambda Function resource.
     */
    private addLambdaFunction(props: ServerlessStackProps): lambda.Function {
        let basePath:string = path.join(__dirname, '..')
        let lambdaSrcFilePath: string = path.join(basePath, 'src')

        var handler = (props.lambdaHandler) ? props.lambdaHandler : 'lambda-function.handler'
        var runtime = (props.lambdaRuntime) ? props.lambdaRuntime : lambda.Runtime.NODEJS_16_X
        var src = (props.lambdaSrc) ? props.lambdaSrc : lambdaSrcFilePath
        var partitionKey = (props.ddbPartitionKey) ? props.ddbPartitionKey : 'itemId'
        var environmentVars:{[key:string]:any} = (props.lambdaEnvVariables) ? props.lambdaEnvVariables : {
            TABLE_NAME: this.DynamoDBTable.tableName,
            PRIMARY_KEY: partitionKey
        }

        return new lambda.Function(this, 'LambdaFunction', {
            code: new lambda.AssetCode(src),
            handler: handler,
            runtime: runtime,
            environment: environmentVars
        })
    }

    /**
     * Function to create Lambda Integration resource to CloudFormation stack.
     * @returns APIGateway Lambda Integration resource.
     */
    private createLambdaIntegration(): apigateway.LambdaIntegration {
        return new apigateway.LambdaIntegration(this.LambdaFunction)
    }

    /**
     * Function to add Rest API resource to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Rest API resource.
     */
    private addRestAPI(props: ServerlessStackProps): apigateway.RestApi {
        var apiName = (props.restApiName) ? props.restApiName : 'rest-api'
        return new apigateway.RestApi(this, 'RestAPI', {
            restApiName: apiName, deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(this.ApigwAccessLogGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
            }
        })
    }

    /**
     * Function to add a Resource in Rest API to CloudFormation stack.
     * @param props  Properties of the construct.
     * @returns Rest API Resource.
     */
    private addResource(props: ServerlessStackProps): apigateway.Resource {
        var apiPath = (props.apiPath) ? props.apiPath : 'mock'
        return this.RestApi.root.addResource(apiPath)
    }

    /**
     * Function to add Outputs to CloudFormation stack.
     * @returns
     */
    private addOutputsToCloudFormationTemplate() {
        var api = "https://" + this.RestApi.restApiId + ".execute-api." + this.region + ".amazonaws.com/prod" + "/mock"
        new core.CfnOutput(this, 'Api', {
            value: api
        })
    }
}