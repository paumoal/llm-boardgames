# 🎮 LLM BoardGames

Plataforma web para enfrentar modelos de lenguaje (LLMs) en juegos de mesa clásicos y de estrategia.

## Juegos incluidos

| Juego | Jugadores | Tipo | Movimiento GDL |
|-------|-----------|------|----------------|
| Tic-Tac-Toe | x vs o | Classic | `mark(row,col)` |
| Suicide TTT | x vs o | Classic | `mark(row,col)` |
| Connect 4 | red vs blue | Classic | `drop(col)` |
| Not Connect 4 | red vs blue | Classic | `drop(col)` |
| Alquerque | red vs black | Strategy | `move(r1,c1,r2,c2)` / `jump(...)` |
| Battle of Numbers | red vs green | Strategy | `move(x1,y1,x2,y2)` |
| Breakthrough | white vs black | Strategy | `move(x,y,x2,y2)` |
| Hex 7×7 | red vs black | Strategy | `place(row,col)` |
| Lines | red vs blue | Strategy | `place(row,col)` |
| Buttons & Lights | robot | Puzzle | `a` / `b` / `c` |
| Hamilton | robot | Puzzle | `move(node)` |
| Hunter | robot | Puzzle | `move(r1,c1,r2,c2)` |

## Modos de juego

- 🧑 vs 🧑 — Humano vs Humano
- 🧑 vs 🤖 — Humano vs LLM
- 🤖 vs 🤖 — LLM vs LLM
- 🧑 solo — Puzzles de un jugador

## Desarrollo local

### Requisitos
- Python 3.10+
- Node.js 18+

### Instalación

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env  # Editar con tu ANTHROPIC_API_KEY

# Frontend
cd ../frontend
npm install
```

### Ejecutar

```bash
# Terminal 1 — Backend (puerto 5000)
cd backend
python app.py

# Terminal 2 — Frontend (puerto 5173, proxy a 5000)
cd frontend
npm run dev
```

Abrir: http://localhost:5173

## Despliegue en Render (gratis)

### Opción 1: Blueprint (recomendada)

1. Crear cuenta en [render.com](https://render.com)
2. New → Blueprint → Seleccionar este repositorio
3. Render detecta `render.yaml` y configura todo
4. Agregar `ANTHROPIC_API_KEY` en las variables de entorno
5. Deploy 🚀

### Opción 2: Manual

1. New → Web Service → Docker
2. Conectar repositorio
3. Variables de entorno:
   - `ANTHROPIC_API_KEY`: tu key de Anthropic
   - `DATABASE_URL`: se genera automáticamente si agregas PostgreSQL

### Opción 3: Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/match` | Crear nueva partida |
| GET | `/api/match/:id` | Info de partida |
| POST | `/api/match/:id/end` | Finalizar partida |
| GET | `/api/matches` | Listar partidas |
| POST | `/api/move` | Registrar jugada |
| GET | `/api/match/:id/csv` | Descargar CSV de la partida |
| GET | `/api/export/all` | Exportar todas las jugadas |
| POST | `/api/llm/move` | Solicitar jugada a un LLM |

## Estructura del proyecto

```
llm-boardgames/
├── backend/
│   ├── app.py              # Flask API + DB
│   ├── requirements.txt
│   ├── epilog.js            # Motor GDL (Stanford)
│   ├── legal.js             # Verificación de jugadas
│   └── rulesheets/          # Reglas .hrf de cada juego
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Aplicación React completa
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Dockerfile
├── render.yaml
├── .env.example
└── README.md
```

## Formato CSV de salida

Cada jugada se registra con los siguientes campos:

| Campo | Descripción |
|-------|-------------|
| id | ID único de la jugada |
| id_match | Identificador de la partida |
| player | Rol del jugador (x, o, red, etc.) |
| move | Movimiento en formato GDL |
| valid | 1 si válido, 0 si inválido |
| win | 1 si ganó con esta jugada |
| model | Nombre del modelo LLM |
| execution_time | Tiempo de respuesta (s) |
| timestamp | Marca de tiempo ISO |
| board | Estado del tablero (GDL facts) |
| legalMoves | Jugadas legales disponibles |
| game | Nombre del juego |
| reason | Justificación del modelo |
| tokens_input | Tokens de entrada (estimado) |
| tokens_output | Tokens de salida (estimado) |

## Licencia

MIT
