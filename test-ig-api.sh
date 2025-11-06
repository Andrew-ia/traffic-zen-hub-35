#!/bin/bash

NOW=$(date +%s)
WEEK_AGO=$((NOW - 604800))
TOKEN="EAAVH4PZBJl9IBPZCjqV0rpye4pMZCpD2cseaaZBvawZBFran9yBAoWlJeFdge91I2mM6YIyvy5HW6si6OPd0V5bTgYQXnbaeuZArGLp7bTSA6ocG0G9bEjGPZBK9cN4VQZCA6jMCtfsnFtXbYqiVLk9KZCxn5Txe4eBIPuVKfQNsiTotRblN3XJZAqwilM4vnEebj3YR6NJt3k9pi9vu9Cff31ZCSVCiOsJ05Qs2WA9mGpu0BtdjPZCvZAQtpCkN2LWoRhgnCwz2pRC6CC5Tvunbnknsbom5jTpQ5"

echo "Testing reach metric..."
curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=reach&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN" | python3 -m json.tool
