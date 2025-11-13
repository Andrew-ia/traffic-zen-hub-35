#!/bin/bash

echo "Testing login endpoint..."
echo ""

# Test with admin credentials
echo "1. Testing with admin credentials (founder@trafficpro.dev / admin123):"
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@trafficpro.dev","password":"admin123"}' | python3 -m json.tool

echo ""
echo ""

# Test with Gisele's credentials
echo "2. Testing with giseleantonangelo@gmail.com (you need to know the password):"
read -s -p "Enter password for giseleantonangelo@gmail.com: " PASSWORD
echo ""
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"giseleantonangelo@gmail.com\",\"password\":\"$PASSWORD\"}" | python3 -m json.tool

echo ""
echo ""

# Test with wrong credentials
echo "3. Testing with wrong credentials:"
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@trafficpro.dev","password":"wrongpassword"}' | python3 -m json.tool

echo ""
