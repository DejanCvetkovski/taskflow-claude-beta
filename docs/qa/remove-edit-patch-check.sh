B=http://localhost:8000/api/todos
ID=$(curl -s -X POST $B -H 'content-type: application/json' -d '{"title":"QA patch target"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "id=$ID"
t(){ echo "--- $1"; curl -s -w ' [%{http_code}]\n' -X PATCH $B/$ID -H 'content-type: application/json' -d "$2"; }
t "completed true" '{"completed":true}'
t "completed false" '{"completed":false}'
t "empty body" '{}'
t "unknown only" '{"foo":1}'
t "completed + unknown" '{"completed":true,"foo":"bar","id":"x","created_at":"2000-01-01T00:00:00Z"}'
t "title only" '{"title":"New"}'
t "title + completed" '{"title":"New","completed":true}'
t "title null + completed" '{"title":null,"completed":false}'
t "title empty + completed" '{"title":"","completed":false}'
t "completed string" '{"completed":"true"}'
t "completed int" '{"completed":1}'
t "completed null" '{"completed":null}'
t "array body" '[]'
echo "--- no body"; curl -s -w ' [%{http_code}]\n' -X PATCH $B/$ID
echo "--- malformed"; curl -s -w ' [%{http_code}]\n' -X PATCH $B/$ID -H 'content-type: application/json' -d '{bad'
echo "--- unknown id"; curl -s -w ' [%{http_code}]\n' -X PATCH $B/00000000-0000-4000-8000-000000000000 -H 'content-type: application/json' -d '{"completed":true}'
echo "--- unknown id + title"; curl -s -w ' [%{http_code}]\n' -X PATCH $B/00000000-0000-4000-8000-000000000000 -H 'content-type: application/json' -d '{"title":"x","completed":true}'
echo "--- final state"; curl -s $B | python3 -m json.tool | head -12
