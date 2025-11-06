#!/bin/bash

NOW=$(date +%s)
WEEK_AGO=$((NOW - 604800))
TOKEN="EAAVH4PZBJl9IBPZCjqV0rpye4pMZCpD2cseaaZBvawZBFran9yBAoWlJeFdge91I2mM6YIyvy5HW6si6OPd0V5bTgYQXnbaeuZArGLp7bTSA6ocG0G9bEjGPZBK9cN4VQZCA6jMCtfsnFtXbYqiVLk9KZCxn5Txe4eBIPuVKfQNsiTotRblN3XJZAqwilM4vnEebj3YR6NJt3k9pi9vu9Cff31ZCSVCiOsJ05Qs2WA9mGpu0BtdjPZCvZAQtpCkN2LWoRhgnCwz2pRC6CC5Tvunbnknsbom5jTpQ5"

# Test follower_count (lifetime metric)
echo "=== Testing follower_count (lifetime) ==="
curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=follower_count&period=lifetime&access_token=$TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== Testing profile_views (day + total_value) ==="
curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=profile_views&metric_type=total_value&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== Testing website_clicks (day + total_value) ==="
curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=website_clicks&metric_type=total_value&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== Testing accounts_engaged (day + total_value) ==="
curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=accounts_engaged&metric_type=total_value&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN" | python3 -m json.tool | head -30
