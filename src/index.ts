import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { buscarJurisprudencia } from './scraper';
import { closeBrowser } from './browser';
import type { BuscaFiltros } from './types';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Busca de jurisprudência
app.post('/buscar', async (req: Request, res: Response, next: NextFunction) => {
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
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[API] Encerrando...');
  await closeBrowser();
  server.close(() => process.exit(0));
});
