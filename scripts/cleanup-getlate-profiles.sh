#!/bin/bash

# Script to list and delete all publishing-provider profiles except the default one
# Usage: ./scripts/cleanup-getlate-profiles.sh [API_KEY]
# If API_KEY is not provided, it will try to read from .env file

set -e

# Default profile ID to keep
DEFAULT_PROFILE_ID="690c738f2e6c6b55e66c14e6"
API_BASE_URL="https://getlate.dev/api/v1"

# Get API key from argument or environment
if [ -z "$1" ]; then
  # Try to read from .env file
  if [ -f .env ]; then
    API_KEY=$(grep -E "^GETLATE_SERVICE_API_KEY=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
  
  if [ -z "$API_KEY" ]; then
    echo "Error: API key not provided and not found in .env file"
    echo "Usage: $0 <API_KEY>"
    echo "   or: Set GETLATE_SERVICE_API_KEY in .env file"
    exit 1
  fi
else
  API_KEY="$1"
fi

echo "🔍 Fetching all profiles..."
echo ""

# List all profiles
PROFILES_RESPONSE=$(curl -s -X GET \
  "${API_BASE_URL}/profiles" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json")

# Check if response is an array or object
if echo "$PROFILES_RESPONSE" | jq -e '.profiles' > /dev/null 2>&1; then
  # Response is wrapped in object with 'profiles' key
  PROFILES=$(echo "$PROFILES_RESPONSE" | jq -r '.profiles[]?')
elif echo "$PROFILES_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  # Response is wrapped in object with 'data' key
  PROFILES=$(echo "$PROFILES_RESPONSE" | jq -r '.data[]?')
elif echo "$PROFILES_RESPONSE" | jq -e 'type == "array"' > /dev/null 2>&1; then
  # Response is a direct array
  PROFILES=$(echo "$PROFILES_RESPONSE" | jq -r '.[]?')
else
  echo "❌ Error: Unexpected response format"
  echo "$PROFILES_RESPONSE" | jq .
  exit 1
fi

# Count profiles
PROFILE_COUNT=$(echo "$PROFILES_RESPONSE" | jq -r '[.profiles[]?, .data[]?, .[]?] | flatten | length' 2>/dev/null || echo "0")

if [ "$PROFILE_COUNT" = "0" ]; then
  echo "ℹ️  No profiles found"
  exit 0
fi

echo "📋 Found $PROFILE_COUNT profile(s):"
echo ""

# Display all profiles
echo "$PROFILES_RESPONSE" | jq -r '
  if type == "array" then .[]
  elif .profiles then .profiles[]
  elif .data then .data[]
  else . end
  | "  - \(._id // .id // "unknown"): \(.name // "unnamed")"
'

echo ""
echo "🛡️  Default profile to keep: $DEFAULT_PROFILE_ID"
echo ""

# Extract profile IDs (using _id or id)
PROFILE_IDS=$(echo "$PROFILES_RESPONSE" | jq -r '
  if type == "array" then .[]
  elif .profiles then .profiles[]
  elif .data then .data[]
  else . end
  | ._id // .id
' | grep -v "^$")

# Filter out default profile
PROFILES_TO_DELETE=$(echo "$PROFILE_IDS" | grep -v "^${DEFAULT_PROFILE_ID}$")

if [ -z "$PROFILES_TO_DELETE" ]; then
  echo "✅ No profiles to delete (only profile $DEFAULT_PROFILE_ID exists)"
  exit 0
fi

DELETE_COUNT=$(echo "$PROFILES_TO_DELETE" | wc -l | tr -d ' ')
echo "🗑️  Profiles to delete: $DELETE_COUNT"
echo "$PROFILES_TO_DELETE" | while read -r profile_id; do
  profile_name=$(echo "$PROFILES_RESPONSE" | jq -r "
    if type == \"array\" then .[]
    elif .profiles then .profiles[]
    elif .data then .data[]
    else . end
    | select(._id == \"$profile_id\" or .id == \"$profile_id\")
    | .name
  ")
  echo "  - $profile_id: $profile_name"
done

echo ""
read -p "⚠️  Are you sure you want to delete these $DELETE_COUNT profile(s)? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled. No profiles were deleted."
  exit 0
fi

echo ""
echo "🗑️  Deleting profiles..."
echo ""

# Delete each profile
DELETED=0
FAILED=0

for profile_id in $PROFILES_TO_DELETE; do
  profile_name=$(echo "$PROFILES_RESPONSE" | jq -r "
    if type == \"array\" then .[]
    elif .profiles then .profiles[]
    elif .data then .data[]
    else . end
    | select(._id == \"$profile_id\" or .id == \"$profile_id\")
    | .name
  ")
  
  echo -n "  Deleting $profile_id ($profile_name)... "
  
  DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
    "${API_BASE_URL}/profiles/${profile_id}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json")
  
  HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "202" ]; then
    echo "✅ Deleted"
    DELETED=$((DELETED + 1))
  else
    echo "❌ Failed (HTTP $HTTP_CODE)"
    if [ -n "$RESPONSE_BODY" ]; then
      echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"
    fi
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "✅ Summary:"
echo "   Deleted: $DELETED"
echo "   Failed: $FAILED"
echo "   Kept: 1 (default profile: $DEFAULT_PROFILE_ID)"

