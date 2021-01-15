import * as core from '@aws-cdk/core'
import * as serverless from 'serverless-infrastructure'

export class MyServerlessStack extends serverless.ServerlessInfrastructureStack {

    constructor(scope: core.Construct, id: string, props: serverless.ServerlessStackProps = {}) {
        super(scope, id, props)
    }
}
const app = new core.App()
new MyServerlessStack(app, 'ServerlessStack-v1')