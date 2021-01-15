import * as core from '@aws-cdk/core'
import * as traditional from 'traditional-infrastructure'

export class MyTraditionalStack extends traditional.TraditionalInfrastructureStack {

    constructor(scope: core.Construct, id: string, props: traditional.TraditionalStackProps = {
                instanceType: "t2.micro"
            }) {
        super(scope, id, props)
    }
}
const app = new core.App()
new MyTraditionalStack(app, 'MyTraditionalStack')