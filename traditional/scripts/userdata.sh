#!/bin/bash
set -x

exec > >(tee -ia /var/log/user-data.log)
exec 2> >(tee -ia /var/log/user-data.log >&2)

date "+%Y-%m-%d %H:%M:%S"
yum install -y python38
echo "Installing pip"
curl -s -O https://bootstrap.pypa.io/get-pip.py
python3 get-pip.py
echo "Installed pip. Installing Python packages"
/usr/local/bin/pip3 install boto3 flask mysql-connector-python
echo "Installed boto3, flask and mysql-connector-python"

current_working_directory=$(pwd)
echo "Current working directory: $current_working_directory"

RDS_HOST="${__RDS_HOST__}"
SECRET_NAME="${__SECRETNAME__}"
echo "RDS Host: $RDS_HOST"

echo "Creating Python code"
cat >code.py <<EOL
import boto3
import base64
import json
import time
from botocore.exceptions import ClientError

import mysql.connector
import flask

app = flask.Flask(__name__)

HANDLE_ERRORS = [
    'DecryptionFailureException', 'InternalServiceErrorException',
    'InvalidParameterException', 'InvalidRequestException',
    'ResourceNotFoundException'
]
DATABASE = 'testdb2020'
TABLE_NAME = 'testtable2020'
MYSQL_HOST = "${!RDS_HOST}"
SECRET_NAME = "${!SECRET_NAME}"
REGION_NAME = "us-east-1"


def get_secret():
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager', region_name=REGION_NAME)

    try:
        get_secret_value_res = client.get_secret_value(SecretId=SECRET_NAME)
        return get_secret_value_res
    except ClientError as e:
        if e.response['Error']['Code'] in HANDLE_ERRORS:
            raise e
    else:
        if 'SecretString' in get_secret_value_res:
            return get_secret_value_res['SecretString']
        else:
            return base64.b64decode(get_secret_value_res['SecretBinary'])


@app.route('/', methods=['GET'])
def home():
    response = get_secret()
    if 'SecretString' in response.keys():
        secret_details = json.loads(response['SecretString'])
    else:
        secret_details = json.loads(response['SecretBinary'])

    db_username = secret_details['username']
    db_password = secret_details['password']

    mydb = mysql.connector.connect(
        host=MYSQL_HOST, user=db_username, password=db_password)
    mycursor = mydb.cursor()
    mycursor.execute("CREATE DATABASE IF NOT EXISTS {}".format(DATABASE))

    mydb = mysql.connector.connect(
        host=MYSQL_HOST, user=db_username,
        password=db_password, database=DATABASE)
    mycursor = mydb.cursor()

    mycursor.execute("CREATE TABLE IF NOT EXISTS {} (id INT PRIMARY KEY, app VARCHAR(255), purpose VARCHAR(255))".format(TABLE_NAME))

    current_time = int(time.time())
    sql = "INSERT INTO {} VALUES (%s, %s, %s)".format(TABLE_NAME)
    val = (current_time, "traditional", "blog")
    mycursor.execute(sql, val)
    mydb.commit()

    mycursor.execute("SELECT * FROM {}".format(TABLE_NAME))
    row_headers = [x[0] for x in mycursor.description]
    results = mycursor.fetchall()

    json_data = []
    for result in results:
        json_data.append(dict(zip(row_headers, result)))

    print(json.dumps(json_data))
    return flask.Response(json.dumps(json_data), mimetype='application/json')


@app.route('/elb', methods=['GET'])
def homeelb():
    return {
        "healthcheck": "success"
    }


app.run(host='0.0.0.0', port=80)

EOL
echo "Created app"

python3 code.py &

echo "Started flask app in background"
date "+%Y-%m-%d %H:%M:%S"
echo "User data execution completed"
