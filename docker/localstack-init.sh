#!/bin/sh
set -eu
awslocal s3 mb s3://eventra || true
awslocal s3api put-bucket-policy --bucket eventra --policy file:///etc/localstack/init/ready.d/policy.json
awslocal s3api put-bucket-cors --bucket eventra --cors-configuration file:///etc/localstack/init/ready.d/cors.json
