import type { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Jujuris API',
    description:
      'API de consulta de jurisprudências do TJGO via scraping do PROJUDI.\n\n' +
      '**Autenticação:** todas as rotas protegidas exigem o header `X-API-Key`.',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
    schemas: {
      BuscaFiltros: {
        type: 'object',
        description: 'Filtros de busca de jurisprudência. Ao menos um filtro de pesquisa deve ser informado.',
        properties: {
          texto: {
            type: 'string',
            description: 'Palavra-chave ou trecho para busca no texto das decisões.',
            example: 'dano moral',
          },
          campoPesquisa: {
            type: 'string',
            description:
              'Filtro legado do módulo antigo. No PROJUDI novo, alguns valores são mapeados para filtros equivalentes.',
            enum: [
              'todos',
              'recursoProcCnj',
              'descricaoRecurso',
              'decisao',
              'ementa',
              'relator',
              'comarca',
              'dataAcordao',
            ],
            example: 'ementa',
          },
          instancia: {
            type: 'string',
            description: 'Instância do processo.',
            enum: ['Todas as instâncias', '1o Grau', 'Turma de Uniformização / Turmas Recursais', 'Tribunal'],
            example: 'Tribunal',
          },
          area: {
            type: 'string',
            description: 'Área do direito.',
            enum: ['Todas as áreas', 'Cível', 'Criminal'],
            example: 'Cível',
          },
          orgaoMateria: {
            type: 'string',
            description: 'Órgão/matéria (subserventia).',
            example: '',
          },
          unidade: {
            type: 'string',
            description: 'Nome da unidade judiciária.',
            example: '',
          },
          unidadeId: {
            type: 'string',
            description: 'ID interno da unidade no PROJUDI, quando conhecido.',
            example: '',
          },
          magistrado: {
            type: 'string',
            description: 'Nome do magistrado.',
            example: '',
          },
          magistradoId: {
            type: 'string',
            description: 'ID interno do magistrado no PROJUDI, quando conhecido.',
            example: '',
          },
          tipoAto: {
            type: 'string',
            description: 'Tipo do ato (ex: Acórdão, Sentença).',
            example: 'Acórdão',
          },
          tipoAtoId: {
            type: 'string',
            description: 'ID interno do tipo de ato no PROJUDI, quando conhecido.',
            example: '',
          },
          numeroProcesso: {
            type: 'string',
            description: 'Número do processo no formato CNJ.',
            example: '0001234-56.2024.8.09.0000',
          },
          dataInicial: {
            type: 'string',
            description: 'Data inicial de publicação (dd/mm/aaaa).',
            example: '01/01/2024',
          },
          dataFinal: {
            type: 'string',
            description: 'Data final de publicação (dd/mm/aaaa).',
            example: '31/12/2024',
          },
          pagina: {
            type: 'integer',
            description: 'Número da página de resultados (começa em 1).',
            default: 1,
            example: 1,
          },
          quantidade: {
            type: 'integer',
            description: 'Quantidade de resultados por página.',
            enum: [10, 20, 50],
            default: 10,
            example: 10,
          },
        },
      },
      ResultadoJurisprudencia: {
        type: 'object',
        properties: {
          numeroProcesso: { type: 'string', example: '0001234-56.2024.8.09.0000' },
          unidade: { type: 'string', example: '1ª Câmara Cível' },
          magistrado: { type: 'string', example: 'Dr. João da Silva' },
          tipoAto: { type: 'string', example: 'Acórdão' },
          dataPublicacao: { type: 'string', example: '10/05/2024' },
          textoDecisao: { type: 'string', example: 'EMENTA: APELAÇÃO CÍVEL...' },
          linkInteiroTeor: { type: 'string', nullable: true, example: 'https://projudi.tjgo.jus.br/...' },
        },
      },
      RespostaBusca: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 42 },
          tempoResposta: { type: 'string', example: '0.45s' },
          pagina: { type: 'integer', example: 1 },
          resultados: {
            type: 'array',
            items: { $ref: '#/components/schemas/ResultadoJurisprudencia' },
          },
        },
      },
      ErroResposta: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Informe ao menos um filtro de pesquisa.' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Verifica se a API está no ar. Não requer autenticação.',
        tags: ['Status'],
        responses: {
          '200': {
            description: 'API operacional',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', example: '2026-05-18T12:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/buscar': {
      post: {
        summary: 'Buscar jurisprudências',
        description:
          'Realiza uma busca de jurisprudências no PROJUDI (TJGO) com base nos filtros informados.\n\n' +
          'Ao menos um filtro de pesquisa deve ser preenchido.\n\n' +
          '> ⚠️ A operação pode levar alguns segundos pois aciona um navegador em background.',
        tags: ['Jurisprudência'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BuscaFiltros' },
              examples: {
                buscaPorTexto: {
                  summary: 'Busca por palavra-chave',
                  value: {
                    texto: 'dano moral',
                    instancia: 'Tribunal',
                    area: 'Cível',
                    pagina: 1,
                    quantidade: 10,
                  },
                },
                buscaPorProcesso: {
                  summary: 'Busca por número de processo',
                  value: {
                    numeroProcesso: '0001234-56.2024.8.09.0000',
                  },
                },
                buscaComData: {
                  summary: 'Busca com filtro de data',
                  value: {
                    texto: 'prisão preventiva',
                    area: 'Criminal',
                    dataInicial: '01/01/2025',
                    dataFinal: '31/12/2025',
                    pagina: 1,
                    quantidade: 20,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Busca realizada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RespostaBusca' },
              },
            },
          },
          '400': {
            description: 'Parâmetros inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErroResposta' },
              },
            },
          },
          '401': {
            description: 'Não autorizado — X-API-Key ausente ou inválida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErroResposta' },
                example: { erro: 'Não autorizado. Informe um X-API-Key válido.' },
              },
            },
          },
          '500': {
            description: 'Erro interno (ex: falha no scraping)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErroResposta' },
              },
            },
          },
        },
      },
    },
  },
};
