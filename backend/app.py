"""
LLM BoardGames — Backend API
Flask + SQLAlchemy + LangChain
"""
import os
import json
import time
import uuid
import csv
import io
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
CORS(app)

db_url = os.environ.get('DATABASE_URL', 'sqlite:///boardgames.db')
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Match(db.Model):
    id = db.Column(db.String(64), primary_key=True,
                   default=lambda: str(uuid.uuid4()))
    game = db.Column(db.String(64), nullable=False)
    player1_model = db.Column(db.String(128))
    player2_model = db.Column(db.String(128))
    winner = db.Column(db.String(64))
    status = db.Column(db.String(16), default='playing')  # playing | finished
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    moves = db.relationship('MoveRecord', backref='match',
                            lazy=True, order_by='MoveRecord.id')


class MoveRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    match_id = db.Column(db.String(64), db.ForeignKey('match.id'),
                         nullable=False)
    player = db.Column(db.String(32))
    move = db.Column(db.Text)
    valid = db.Column(db.Integer, default=1)
    win = db.Column(db.Integer, default=0)
    model = db.Column(db.String(128))
    execution_time = db.Column(db.Float, default=0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    board = db.Column(db.Text)
    legal_moves = db.Column(db.Text)
    game = db.Column(db.String(64))
    reason = db.Column(db.Text, default='')
    tokens_input = db.Column(db.Integer, default=0)
    tokens_output = db.Column(db.Integer, default=0)


with app.app_context():
    db.create_all()

# ---------------------------------------------------------------------------
# API — Matches
# ---------------------------------------------------------------------------
@app.route('/api/match', methods=['POST'])
def create_match():
    d = request.json
    m = Match(game=d['game'],
              player1_model=d.get('player1_model', 'human'),
              player2_model=d.get('player2_model', 'human'))
    db.session.add(m)
    db.session.commit()
    return jsonify({'match_id': m.id})


@app.route('/api/match/<match_id>', methods=['GET'])
def get_match(match_id):
    m = Match.query.get_or_404(match_id)
    return jsonify({
        'id': m.id, 'game': m.game, 'winner': m.winner,
        'status': m.status,
        'player1_model': m.player1_model,
        'player2_model': m.player2_model,
        'created_at': m.created_at.isoformat(),
        'move_count': len(m.moves)
    })


@app.route('/api/match/<match_id>/end', methods=['POST'])
def end_match(match_id):
    d = request.json
    m = Match.query.get_or_404(match_id)
    m.winner = d.get('winner')
    m.status = 'finished'
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/matches', methods=['GET'])
def list_matches():
    game = request.args.get('game')
    q = Match.query.order_by(Match.created_at.desc())
    if game:
        q = q.filter_by(game=game)
    matches = q.limit(100).all()
    return jsonify([{
        'id': m.id, 'game': m.game, 'winner': m.winner,
        'status': m.status,
        'player1': m.player1_model, 'player2': m.player2_model,
        'created_at': m.created_at.isoformat(),
        'move_count': len(m.moves)
    } for m in matches])


# ---------------------------------------------------------------------------
# API — Move records
# ---------------------------------------------------------------------------
@app.route('/api/move', methods=['POST'])
def record_move():
    d = request.json
    rec = MoveRecord(
        match_id=d['match_id'],
        player=d['player'],
        move=json.dumps(d['move']),
        valid=d.get('valid', 1),
        win=d.get('win', 0),
        model=d.get('model', 'human'),
        execution_time=d.get('execution_time', 0),
        board=json.dumps(d.get('board', [])),
        legal_moves=json.dumps(d.get('legal_moves', [])),
        game=d.get('game', ''),
        reason=d.get('reason', ''),
        tokens_input=d.get('tokens_input', 0),
        tokens_output=d.get('tokens_output', 0),
    )
    db.session.add(rec)
    db.session.commit()
    return jsonify({'id': rec.id})


# ---------------------------------------------------------------------------
# API — CSV download
# ---------------------------------------------------------------------------
CSV_HEADERS = [
    'id', 'id_match', 'player', 'move', 'valid', 'win', 'model',
    'execution_time', 'timestamp', 'board', 'legalMoves', 'game',
    'reason', 'tokens_input', 'tokens_output'
]

@app.route('/api/match/<match_id>/csv')
def download_csv(match_id):
    moves = (MoveRecord.query
             .filter_by(match_id=match_id)
             .order_by(MoveRecord.id).all())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    for m in moves:
        w.writerow([
            m.id, m.match_id, m.player, m.move, m.valid, m.win,
            m.model, f'{m.execution_time:.4f}', m.timestamp.isoformat(),
            m.board, m.legal_moves, m.game, m.reason,
            m.tokens_input, m.tokens_output
        ])
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename={match_id}.csv'
        }
    )


@app.route('/api/export/all')
def export_all():
    """Export all moves across all matches."""
    moves = MoveRecord.query.order_by(MoveRecord.id).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    for m in moves:
        w.writerow([
            m.id, m.match_id, m.player, m.move, m.valid, m.win,
            m.model, f'{m.execution_time:.4f}', m.timestamp.isoformat(),
            m.board, m.legal_moves, m.game, m.reason,
            m.tokens_input, m.tokens_output
        ])
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=all_moves.csv'
        }
    )


# ---------------------------------------------------------------------------
# API — LLM move (server-side, avoids exposing API keys in frontend)
# ---------------------------------------------------------------------------
@app.route('/api/llm/move', methods=['POST'])
def llm_move():
    """
    Request body:
    {
      "model": "claude-sonnet-4-20250514",
      "game_name": "Tic-Tac-Toe",
      "game_desc": "...",
      "board": [...],
      "role": "x",
      "legal_moves": [["mark","1","1"], ...],
      "legal_moves_formatted": ["0: mark(1,1)", ...]
    }
    """
    d = request.json
    model = d.get('model', 'claude-sonnet-4-20250514')
    legal = d['legal_moves']
    formatted = d.get('legal_moves_formatted', [])

    moves_str = "\n".join(formatted) if formatted else \
        "\n".join(f"{i}: {m}" for i, m in enumerate(legal))

    prompt = (
        f'You are playing "{d["game_name"]}". {d["game_desc"]}\n\n'
        f'Current state (GDL): {json.dumps(d["board"])}\n\n'
        f'You are: {d["role"]}\n\n'
        f'Legal moves:\n{moves_str}\n\n'
        f'Respond ONLY with JSON: {{"move_index": <number>, "reason": "<brief>"}}'
    )

    input_tokens = len(prompt.split()) * 1.3

    try:
        # Try LangChain first
        from langchain_anthropic import ChatAnthropic
        from langchain_core.messages import HumanMessage

        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            raise ValueError("No ANTHROPIC_API_KEY")

        llm = ChatAnthropic(model=model, api_key=api_key,
                            max_tokens=512, temperature=0.3)
        t0 = time.time()
        resp = llm.invoke([HumanMessage(content=prompt)])
        elapsed = time.time() - t0
        text = resp.content
        output_tokens = len(text.split()) * 1.3

    except Exception as e:
        # Fallback: direct HTTP
        import urllib.request
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            return jsonify({
                'move_index': 0,
                'reason': 'No API key configured',
                'time': 0,
                'tokens': {'input': 0, 'output': 0}
            })

        t0 = time.time()
        body = json.dumps({
            'model': model, 'max_tokens': 512,
            'messages': [{'role': 'user', 'content': prompt}]
        }).encode()
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body,
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01'
            }
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        elapsed = time.time() - t0
        text = ''.join(b.get('text', '') for b in data.get('content', []))
        output_tokens = len(text.split()) * 1.3

    # Parse response
    idx, reason = 0, text
    try:
        clean = text.strip().replace('```json', '').replace('```', '').strip()
        parsed = json.loads(clean)
        idx = parsed.get('move_index', 0)
        reason = parsed.get('reason', '')
    except Exception:
        import re
        m = re.search(r'\d+', text)
        if m:
            idx = int(m.group())

    if idx < 0 or idx >= len(legal):
        idx = 0

    return jsonify({
        'move_index': idx,
        'reason': reason,
        'time': round(elapsed, 4),
        'tokens': {
            'input': int(input_tokens),
            'output': int(output_tokens)
        }
    })


# ---------------------------------------------------------------------------
# Serve frontend (SPA fallback)
# ---------------------------------------------------------------------------
@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path=''):
    static = app.static_folder
    if static and path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    if static and os.path.exists(os.path.join(static, 'index.html')):
        return send_from_directory(static, 'index.html')
    return jsonify({'status': 'API running', 'docs': '/api/matches'}), 200


# ---------------------------------------------------------------------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_DEBUG', False))
