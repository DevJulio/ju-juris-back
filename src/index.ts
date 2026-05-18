import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { buscarJurisprudencia } from './scraper';
import { closeBrowser } from './browser';
import { swaggerSpec } from './swagger';
import type { BuscaFiltros } from './types';

const app = express();
const PORT = process.env.PORT ?? 3001;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('[API] Variável API_KEY não definida no .env. Encerrando.');
  process.exit(1);
}

function autenticar(req: Request, res: Response, next: NextFunction): void {
  const chave = req.headers['x-api-key'];
  if (chave !== API_KEY) {
    res.status(401).json({ erro: 'Não autorizado. Informe um X-API-Key válido.' });
    return;
  }
  next();
}

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'ngrok-skip-browser-warning'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // responde preflight para todas as rotas
app.use(express.json());

// Documentação interativa
app.get('/docs.json', (req: Request, res: Response) => {
  const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
  const host = req.headers['x-forwarded-host'] ?? req.get('host');
  const spec = {
    ...swaggerSpec,
    servers: [{ url: `${protocol}://${host}`, description: 'Servidor atual' }],
  };
  res.json(spec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerOptions: { url: '/docs.json' } }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Busca de jurisprudência
app.post('/buscar', autenticar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filtros: BuscaFiltros = req.body;

    if (!filtros.texto && !filtros.numeroProcesso) {
      res.status(400).json({ erro: 'Informe ao menos "texto" ou "numeroProcesso".' });
      return;
    }

    console.log('[API] POST /buscar', filtros);
    const resultado = await buscarJurisprudencia(filtros);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Tratamento de erros
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Erro:', err.message);
  res.status(500).json({ erro: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`[API] Servidor rodando em http://localhost:${PORT}`);
  console.log(`[API] Documentação disponível em http://localhost:${PORT}/docs`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[API] Encerrando...');
  await closeBrowser();
  server.close(() => process.exit(0));
});
