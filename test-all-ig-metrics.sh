#!/bin/bash

NOW=$(date +%s)
WEEK_AGO=$((NOW - 604800))
TOKEN="EAAVH4PZBJl9IBPZCjqV0rpye4pMZCpD2cseaaZBvawZBFran9yBAoWlJeFdge91I2mM6YIyvy5HW6si6OPd0V5bTgYQXnbaeuZArGLp7bTSA6ocG0G9bEjGPZBK9cN4VQZCA6jMCtfsnFtXbYqiVLk9KZCxn5Txe4eBIPuVKfQNsiTotRblN3XJZAqwilM4vnEebj3YR6NJt3k9pi9vu9Cff31ZCSVCiOsJ05Qs2WA9mGpu0BtdjPZCvZAQtpCkN2LWoRhgnCwz2pRC6CC5Tvunbnknsbom5jTpQ5"

echo "=== Testing all possible Instagram User Insights metrics ==="
echo ""

# List of all possible metrics from Instagram API docs
METRICS=(
  "reach"
  "follower_count"
  "online_followers"
  "profile_views"
  "website_clicks"
  "email_contacts"
  "phone_call_clicks"
  "get_directions_clicks"
  "text_message_clicks"
  "accounts_engaged"
  "total_interactions"
  "likes"
  "comments"
  "shares"
  "saves"
  "replies"
  "engaged_audience_demographics"
  "reached_audience_demographics"
  "follower_demographics"
  "follows_and_unfollows"
  "profile_links_taps"
  "views"
)

for metric in "${METRICS[@]}"; do
  echo "--- Testing: $metric ---"

  # Try with period=day first
  RESPONSE=$(curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=$metric&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN")

  if echo "$RESPONSE" | grep -q '"error"'; then
    # Try with metric_type=total_value
    RESPONSE=$(curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=$metric&metric_type=total_value&period=day&since=$WEEK_AGO&until=$NOW&access_token=$TOKEN")

    if echo "$RESPONSE" | grep -q '"error"'; then
      # Try lifetime period
      RESPONSE=$(curl -s "https://graph.facebook.com/v21.0/17841408314288323/insights?metric=$metric&period=lifetime&access_token=$TOKEN")

      if echo "$RESPONSE" | grep -q '"error"'; then
        ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['error']['message'])" 2>/dev/null || echo "Unknown error")
        echo "  ❌ NOT AVAILABLE - $ERROR_MSG"
      else
        echo "  ✅ AVAILABLE (lifetime)"
        echo "$RESPONSE" | python3 -m json.tool | head -20
      fi
    else
      echo "  ✅ AVAILABLE (day + total_value)"
      echo "$RESPONSE" | python3 -m json.tool | head -20
    fi
  else
    echo "  ✅ AVAILABLE (day)"
    echo "$RESPONSE" | python3 -m json.tool | head -20
  fi

  echo ""
done
