const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';

export const handler = async () : Promise <any> => {

    console.log('PRIMARY_KEY: ' + PRIMARY_KEY)

    const params = {
        TableName: TABLE_NAME,
        Item: {
            [PRIMARY_KEY]: Math.floor(Date.now()).toString(),
            app: 'serverless',
            purpose: 'blog'
        }
    }

    try {
        await db.put(params).promise();
        console.log('Added item to DynamoDB')
        const response = await db.scan(params).promise();
        return { statusCode: 200, body: JSON.stringify(response.Items) }
    } catch (dbError) {
        return { statusCode: 500, body: JSON.stringify(dbError) }
    }
}