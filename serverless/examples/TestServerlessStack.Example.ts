import * as core from '@aws-cdk/core'
import { ServerlessInfrastructureStack } from '../lib/ServerlessStack'
import { ServerlessStackProps } from '../lib/ServerlessStackProps'

export class TestServerlessInfraStack extends ServerlessInfrastructureStack {

    constructor(scope: core.Construct, id: string, props: ServerlessStackProps = {}) {
        super(scope, id, props)
    }
}
const app = new core.App()
new TestServerlessInfraStack(app, 'TestServerlessInfraStack')