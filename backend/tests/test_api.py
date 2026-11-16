from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_recommend_and_prep():
    r = client.post("/api/career/recommend", json={"skills": ["python", "sql"], "interests": ["data"]})
    assert r.status_code == 200 and r.json()["careers"][0]["title"]
    p = client.post("/api/career/prep", json={"role": "Data Analyst"})
    assert p.status_code == 200 and p.json()["plan"]


def test_mock_test_flow_hides_answers():
    t = client.post("/api/tests/generate", json={"count": 3}).json()
    assert "answer_index" not in t["questions"][0]
    res = client.post(f"/api/tests/{t['test_id']}/submit", json={"answers": [0, 1, 2]}).json()
    assert res["total"] == 3 and len(res["review"]) == 3
    assert client.post("/api/tests/nope/submit", json={"answers": []}).status_code == 404


def test_grammar_offline():
    r = client.post("/api/grammar/check", json={"text": "i dont know  alot"}).json()
    assert r["corrected"].startswith("I don't know a lot")


def test_speaking_feedback():
    r = client.post("/api/speaking/feedback",
                    json={"topic": "x", "transcript": "um so like I think this is good", "duration_seconds": 6}).json()
    assert r["words"] == 8 and r["fillers"]["um"] == 1


def test_gd_flow():
    s = client.post("/api/gd/start", json={"topic": "Remote work"}).json()
    assert len(s["messages"]) >= 1
    t = client.post("/api/gd/turn", json={"topic": "Remote work", "history": [], "user_message": "I agree"}).json()
    assert t["messages"]
    e = client.post("/api/gd/evaluate", json={"topic": "x", "history": [{"speaker": "You", "text": "hello there"}]})
    assert e.status_code == 200


def test_interview_websocket():
    with client.websocket_connect("/ws/interview") as ws:
        ws.send_json({"type": "ping"})
        assert ws.receive_json()["type"] == "pong"
        ws.send_json({"type": "answer", "text": "too early"})
        assert ws.receive_json()["type"] == "error"
        ws.send_json({"type": "start", "role": "Data Analyst", "num_questions": 3})
        q = ws.receive_json()
        assert q["type"] == "question" and q["total"] == 3
        ws.send_json({"type": "answer", "text": "   "})
        assert ws.receive_json()["type"] == "empty"
        for _ in range(3):
            ws.send_json({"type": "answer", "text": "For example, when I built a dashboard we reduced reporting time by 30 percent."})
            assert ws.receive_json()["type"] == "feedback"
            nxt = ws.receive_json()
        assert nxt["type"] == "summary" and nxt["average"] > 0
