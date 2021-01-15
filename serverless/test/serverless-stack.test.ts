import { Stack } from '@aws-cdk/core'
import { expect, haveResource, countResources, haveResourceLike } from '@aws-cdk/assert'
import '@aws-cdk/assert/jest'
import lambda = require('@aws-cdk/aws-lambda')

import { ServerlessInfrastructureStack } from '../lib/ServerlessStack'
import { ServerlessStackProps } from '../lib/ServerlessStackProps'

const stack = new Stack()
const props: ServerlessStackProps = {}
const myStack = new ServerlessInfrastructureStack(stack, 'TestServerlessStack', props)

// Fine-Grained Assertions and validation tests
test('Rest API - All required resources are created', () => {
    expect(myStack).to(countResources('AWS::ApiGateway::RestApi', 1))
    expect(myStack).to(countResources('AWS::ApiGateway::Resource', 1))
    expect(myStack).to(countResources('AWS::ApiGateway::Method', 1))
    expect(myStack).to(countResources('AWS::ApiGateway::Deployment', 1))
    expect(myStack).to(countResources('AWS::ApiGateway::Stage', 1))
})

test('Rest API - Rest API has valid (as expected) properties', () => {
    expect(myStack).to(haveResourceLike('AWS::ApiGateway::RestApi', {
        Name: "rest-api"
    }))
})

test('Rest API Resource - API resource configuration is valid', () => {
    expect(myStack).to(haveResourceLike('AWS::ApiGateway::Resource', {
        PathPart: "mock",
        RestApiId: {"Ref": "RestAPI1CC12F26"},
        ParentId: {"Fn::GetAtt": ["RestAPI1CC12F26","RootResourceId"]}
    }))
})

test('Rest API Method - Method resource configuration is valid', () => {
    expect(myStack).to(haveResourceLike('AWS::ApiGateway::Method', {
        RestApiId: {"Ref": "RestAPI1CC12F26"},
        ResourceId: {"Ref": "RestAPImock26B2BA1D"},
        Integration: {
            "IntegrationHttpMethod": "POST",
            "Uri": {"Fn::Join":["",["arn:",{"Ref":"AWS::Partition"},":apigateway:",{"Ref": "AWS::Region"},":lambda:path/2015-03-31/functions/",{"Fn::GetAtt": ["LambdaFunctionBF21E41F","Arn"]},"/invocations"]]},
            "Type": "AWS_PROXY"
        }
    }))
})

test('Rest API Deployment - Deployment resource configuration is valid', () => {
    expect(myStack).to(haveResourceLike('AWS::ApiGateway::Deployment', {
        RestApiId: {"Ref": "RestAPI1CC12F26"}
    }))
})

test('Rest API Stage - Stage resource configuration is valid', () => {
    expect(myStack).to(haveResourceLike('AWS::ApiGateway::Stage', {
        RestApiId: {"Ref": "RestAPI1CC12F26"},
        DeploymentId: {"Ref": "RestAPIDeploymentD35A5380ae3ffd32cebae391c2b7b35eed08305a"},
        StageName: "prod"
    }))
})

test('Override default values - Overriding properties', () => {
    const stack = new Stack()
    const props: ServerlessStackProps = {
        restApiName: 'override-api',
        apiPath: 'mockpath',
        stageName: 'qa',
        ddbTableName: 'newDynamoDBTable',
        ddbPartitionKey: 'newItemId',
        lambdaHandler: 'new_lambda_function.lambda_handler',
        lambdaRuntime: lambda.Runtime.NODEJS_12_X
    }
    const myOverrideStack = new ServerlessInfrastructureStack(stack, 'TestServerlessStack', props)
    expect(myOverrideStack).to(haveResourceLike('AWS::ApiGateway::RestApi', {Name: "override-api"}))
    expect(myOverrideStack).to(haveResourceLike('AWS::ApiGateway::Resource', {PathPart: "mockpath"}))
    expect(myOverrideStack).to(haveResourceLike('AWS::ApiGateway::Stage', {StageName:"prod"}))
})
