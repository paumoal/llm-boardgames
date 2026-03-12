"""
LLM BoardGames — Backend API
Flask + SQLAlchemy
"""
import os
import json
import time
import uuid
import csv
import io
import re
import urllib.request
from datetime import datetime

# Load .env file for local development (Render injects env vars directly)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

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
# LLM providers — detect provider from model name or prefix
# ---------------------------------------------------------------------------
# OpenRouter models use prefix "openrouter/" e.g. "openrouter/google/gemini-2.0-flash"
# Azure models use prefix "azure/" e.g. "azure/gpt-4o"

def detect_provider(model_name):
    """Return ('openai'|'anthropic'|'gemini'|'openrouter'|'azure', api_key, clean_model)."""
    mn = model_name.strip()

    # OpenRouter: prefix "openrouter/" or OPENROUTER_API_KEY set + model has "/"
    if mn.startswith('openrouter/'):
        key = os.environ.get('OPENROUTER_API_KEY', '')
        if key:
            return 'openrouter', key, mn[len('openrouter/'):]
        raise ValueError('OPENROUTER_API_KEY not configured')

    # Azure: prefix "azure/"
    if mn.startswith('azure/'):
        key = os.environ.get('AZURE_OPENAI_API_KEY', '')
        if key:
            return 'azure', key, mn[len('azure/'):]
        raise ValueError('AZURE_OPENAI_API_KEY not configured')

    # OpenAI
    if any(mn.startswith(m) for m in ['gpt-', 'o1', 'o3']) or 'gpt' in mn:
        key = os.environ.get('OPENAI_API_KEY', '')
        if key:
            return 'openai', key, mn
        raise ValueError('OPENAI_API_KEY not configured')

    # Gemini
    if 'gemini' in mn:
        key = os.environ.get('GOOGLE_API_KEY', os.environ.get('GEMINI_API_KEY', ''))
        if key:
            return 'gemini', key, mn
        raise ValueError('GOOGLE_API_KEY not configured')

    # Anthropic (default)
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if key:
        return 'anthropic', key, mn
    raise ValueError('ANTHROPIC_API_KEY not configured')


def _http_post(url, body_dict, headers, timeout=90):
    """Helper: HTTP POST returning parsed JSON."""
    data = json.dumps(body_dict).encode()
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def call_openai(model, prompt, api_key):
    """Call OpenAI chat completions."""
    data = _http_post(
        'https://api.openai.com/v1/chat/completions',
        {'model': model, 'max_tokens': 512, 'temperature': 0.3,
         'messages': [{'role': 'user', 'content': prompt}]},
        {'Content-Type': 'application/json',
         'Authorization': f'Bearer {api_key}'}
    )
    text = data['choices'][0]['message']['content']
    u = data.get('usage', {})
    return text, u.get('prompt_tokens', 0), u.get('completion_tokens', 0)


def call_anthropic(model, prompt, api_key):
    """Call Anthropic messages API."""
    data = _http_post(
        'https://api.anthropic.com/v1/messages',
        {'model': model, 'max_tokens': 512,
         'messages': [{'role': 'user', 'content': prompt}]},
        {'Content-Type': 'application/json',
         'x-api-key': api_key, 'anthropic-version': '2023-06-01'}
    )
    text = ''.join(b.get('text', '') for b in data.get('content', []))
    u = data.get('usage', {})
    return text, u.get('input_tokens', 0), u.get('output_tokens', 0)


def call_gemini(model, prompt, api_key):
    """Call Google Gemini generateContent API."""
    url = (f'https://generativelanguage.googleapis.com/v1beta/models/'
           f'{model}:generateContent?key={api_key}')
    data = _http_post(
        url,
        {'contents': [{'parts': [{'text': prompt}]}],
         'generationConfig': {'maxOutputTokens': 512, 'temperature': 0.3}},
        {'Content-Type': 'application/json'}
    )
    text = data['candidates'][0]['content']['parts'][0]['text']
    u = data.get('usageMetadata', {})
    return text, u.get('promptTokenCount', 0), u.get('candidatesTokenCount', 0)


def call_openrouter(model, prompt, api_key):
    """Call OpenRouter — same format as OpenAI but different URL + header."""
    data = _http_post(
        'https://openrouter.ai/api/v1/chat/completions',
        {'model': model, 'max_tokens': 512, 'temperature': 0.3,
         'messages': [{'role': 'user', 'content': prompt}]},
        {'Content-Type': 'application/json',
         'Authorization': f'Bearer {api_key}',
         'HTTP-Referer': 'https://llm-boardgames.onrender.com',
         'X-Title': 'LLM BoardGames'}
    )
    text = data['choices'][0]['message']['content']
    u = data.get('usage', {})
    return text, u.get('prompt_tokens', 0), u.get('completion_tokens', 0)


def call_azure(model, prompt, api_key):
    """Call Azure OpenAI — requires AZURE_OPENAI_ENDPOINT env var."""
    endpoint = os.environ.get('AZURE_OPENAI_ENDPOINT', '').rstrip('/')
    api_version = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-10-21')
    if not endpoint:
        raise ValueError('AZURE_OPENAI_ENDPOINT not configured')
    url = f'{endpoint}/openai/deployments/{model}/chat/completions?api-version={api_version}'
    data = _http_post(
        url,
        {'max_tokens': 512, 'temperature': 0.3,
         'messages': [{'role': 'user', 'content': prompt}]},
        {'Content-Type': 'application/json', 'api-key': api_key}
    )
    text = data['choices'][0]['message']['content']
    u = data.get('usage', {})
    return text, u.get('prompt_tokens', 0), u.get('completion_tokens', 0)


# ---------------------------------------------------------------------------
# API — LLM move (multi-provider: OpenAI, Anthropic, Gemini)
# ---------------------------------------------------------------------------
@app.route('/api/llm/move', methods=['POST'])
def llm_move():
    """
    Request body:
    {
      "model": "gpt-4o-mini",       ← or any Claude/Gemini model
      "game_name": "Tic-Tac-Toe",
      "game_desc": "...",
      "board": [...],
      "role": "x",
      "legal_moves": [["mark","1","1"], ...],
      "legal_moves_formatted": ["0: mark(1,1)", ...]
    }
    """
    d = request.json
    model = d.get('model', 'gpt-4o-mini')
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

    # Detect provider and call
    try:
        provider, api_key, clean_model = detect_provider(model)
    except ValueError as e:
        return jsonify({
            'move_index': 0,
            'reason': str(e),
            'time': 0,
            'tokens': {'input': 0, 'output': 0}
        })

    try:
        t0 = time.time()
        if provider == 'openai':
            text, in_tok, out_tok = call_openai(clean_model, prompt, api_key)
        elif provider == 'gemini':
            text, in_tok, out_tok = call_gemini(clean_model, prompt, api_key)
        elif provider == 'openrouter':
            text, in_tok, out_tok = call_openrouter(clean_model, prompt, api_key)
        elif provider == 'azure':
            text, in_tok, out_tok = call_azure(clean_model, prompt, api_key)
        else:
            text, in_tok, out_tok = call_anthropic(clean_model, prompt, api_key)
        elapsed = time.time() - t0
    except Exception as e:
        return jsonify({
            'move_index': 0,
            'reason': f'API error: {str(e)[:200]}',
            'time': 0,
            'tokens': {'input': 0, 'output': 0}
        })

    # Parse response
    idx, reason = 0, text
    try:
        clean = text.strip().replace('```json', '').replace('```', '').strip()
        parsed = json.loads(clean)
        idx = parsed.get('move_index', 0)
        reason = parsed.get('reason', '')
    except Exception:
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
            'input': int(in_tok),
            'output': int(out_tok)
        }
    })


# ---------------------------------------------------------------------------
# API — Available models (based on configured API keys)
# ---------------------------------------------------------------------------
@app.route('/api/models')
def list_models():
    """Return available LLM models based on which API keys are set."""
    models = [{'id': 'random', 'name': 'Random AI (Demo)', 'provider': 'local'}]

    if os.environ.get('OPENAI_API_KEY'):
        models.extend([
            {'id': 'gpt-4o', 'name': 'GPT-4o', 'provider': 'openai'},
            {'id': 'gpt-4o-mini', 'name': 'GPT-4o Mini', 'provider': 'openai'},
            {'id': 'gpt-4-turbo', 'name': 'GPT-4 Turbo', 'provider': 'openai'},
            {'id': 'gpt-3.5-turbo', 'name': 'GPT-3.5 Turbo', 'provider': 'openai'},
            {'id': 'o3-mini', 'name': 'o3-mini', 'provider': 'openai'},
        ])
    if os.environ.get('ANTHROPIC_API_KEY'):
        models.extend([
            {'id': 'claude-sonnet-4-20250514', 'name': 'Claude Sonnet 4', 'provider': 'anthropic'},
            {'id': 'claude-3-5-sonnet-20241022', 'name': 'Claude 3.5 Sonnet', 'provider': 'anthropic'},
            {'id': 'claude-3-haiku-20240307', 'name': 'Claude 3 Haiku', 'provider': 'anthropic'},
        ])
    if os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY'):
        models.extend([
            {'id': 'gemini-2.0-flash', 'name': 'Gemini 2.0 Flash', 'provider': 'gemini'},
            {'id': 'gemini-2.0-flash-lite', 'name': 'Gemini 2.0 Flash Lite', 'provider': 'gemini'},
            {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro', 'provider': 'gemini'},
        ])
    if os.environ.get('OPENROUTER_API_KEY'):
        models.extend([
            {'id': 'openrouter/openai/gpt-4o', 'name': 'GPT-4o (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/openai/gpt-4o-mini', 'name': 'GPT-4o Mini (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/anthropic/claude-3.5-sonnet', 'name': 'Claude 3.5 Sonnet (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/google/gemini-2.0-flash-exp', 'name': 'Gemini 2.0 Flash (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/meta-llama/llama-3.1-70b-instruct', 'name': 'Llama 3.1 70B (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/deepseek/deepseek-chat-v3-0324', 'name': 'DeepSeek V3 (OpenRouter)', 'provider': 'openrouter'},
            {'id': 'openrouter/mistralai/mistral-large', 'name': 'Mistral Large (OpenRouter)', 'provider': 'openrouter'},
        ])
    if os.environ.get('AZURE_OPENAI_API_KEY') and os.environ.get('AZURE_OPENAI_ENDPOINT'):
        # Azure models are deployment names — user configures these
        azure_models = os.environ.get('AZURE_OPENAI_MODELS', 'gpt-4o,gpt-4o-mini')
        for m in azure_models.split(','):
            m = m.strip()
            if m:
                models.append({'id': f'azure/{m}', 'name': f'{m} (Azure)', 'provider': 'azure'})

    return jsonify(models)


# ---------------------------------------------------------------------------
# API — Debug: check which API keys are configured
# ---------------------------------------------------------------------------
@app.route('/api/debug/keys')
def debug_keys():
    """Shows which API keys are configured (first/last 4 chars only)."""
    def mask(key_name):
        val = os.environ.get(key_name, '')
        if not val:
            return None
        if len(val) <= 8:
            return f'{val[:2]}...{val[-2:]}'
        return f'{val[:4]}...{val[-4:]}'

    return jsonify({
        'OPENAI_API_KEY': mask('OPENAI_API_KEY'),
        'ANTHROPIC_API_KEY': mask('ANTHROPIC_API_KEY'),
        'GOOGLE_API_KEY': mask('GOOGLE_API_KEY'),
        'OPENROUTER_API_KEY': mask('OPENROUTER_API_KEY'),
        'AZURE_OPENAI_API_KEY': mask('AZURE_OPENAI_API_KEY'),
        'AZURE_OPENAI_ENDPOINT': os.environ.get('AZURE_OPENAI_ENDPOINT', None),
        'DATABASE_URL': 'configured' if os.environ.get('DATABASE_URL') else 'sqlite (default)',
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
