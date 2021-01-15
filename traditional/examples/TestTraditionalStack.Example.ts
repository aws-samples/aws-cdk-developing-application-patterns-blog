import * as core from '@aws-cdk/core'
import { TraditionalInfrastructureStack } from '../lib/TraditionalStack'
import { TraditionalStackProps } from '../lib/TraditionalStackProps'

export class TestClassicStack extends TraditionalInfrastructureStack {

    constructor(scope: core.Construct, id: string, props: TraditionalStackProps = {
                instanceType: "t2.micro"
            }) {
        super(scope, id, props)
    }
}
const app = new core.App()
new TestClassicStack(app, 'TestClassicStack')