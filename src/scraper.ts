import { Page } from 'playwright';
import { getBrowser } from './browser';
import type { BuscaFiltros, RespostaBusca, ResultadoJurisprudencia } from './types';

const PROJUDI_URL = 'https://projudi.tjgo.jus.br/ConsultaJurisprudencia';

function normalizarData(valor: string): string {
  return valor.length === 10 && valor[4] === '-'
    ? `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`
    : valor;
}

function normalizarCampoPesquisa(filtros: BuscaFiltros): BuscaFiltros {
  const normalizados: BuscaFiltros = { ...filtros };
  const texto = filtros.texto?.trim();

  if (!texto) return normalizados;

  if (filtros.campoPesquisa === 'recursoProcCnj' && !normalizados.numeroProcesso) {
    normalizados.numeroProcesso = texto;
    normalizados.texto = undefined;
  }

  if (filtros.campoPesquisa === 'relator' && !normalizados.magistrado) {
    normalizados.magistrado = texto;
    normalizados.texto = undefined;
  }

  if (filtros.campoPesquisa === 'comarca' && !normalizados.unidade) {
    normalizados.unidade = texto;
    normalizados.texto = undefined;
  }

  if (filtros.campoPesquisa === 'dataAcordao' && !normalizados.dataInicial && !normalizados.dataFinal) {
    normalizados.dataInicial = normalizarData(texto);
    normalizados.dataFinal = normalizarData(texto);
    normalizados.texto = undefined;
  }

  if (filtros.campoPesquisa === 'ementa') {
    normalizados.tipoAto = 'Ementa';
    normalizados.tipoAtoId = '124';
  }

  if (filtros.campoPesquisa === 'decisao') {
    normalizados.tipoAto = 'Decisão';
    normalizados.tipoAtoId = '15';
  }

  return normalizados;
}

async function selecionarPorLabel(page: Page, selector: string, label: string): Promise<void> {
  try {
    const selecionado = await page.selectOption(selector, { label });
    if (selecionado.length === 0) {
      console.warn(`[Scraper] Opção não encontrada em ${selector}: ${label}`);
    }
    await page.waitForTimeout(200);
  } catch (err) {
    console.warn(`[Scraper] Falha ao selecionar ${label} em ${selector}:`, (err as Error).message);
  }
}

async function preencherCampoTexto(
  page: Page,
  selector: string,
  valor?: string,
  hiddenSelector?: string,
  hiddenValor?: string,
): Promise<void> {
  if (!valor && !hiddenValor) return;

  if (valor) {
    await page.fill(selector, valor);
  }

  if (hiddenSelector && hiddenValor) {
    await page.evaluate(
      ({ selector, value }) => {
        const input = document.querySelector(selector) as HTMLInputElement | null;
        if (input) input.value = value;
      },
      { selector: hiddenSelector, value: hiddenValor },
    );
  }
}

async function definirQuantidadePorPagina(page: Page, quantidade?: number): Promise<void> {
  if (!quantidade) return;

  await page.evaluate((valor) => {
    const form = document.querySelector('#Formulario') ?? document.forms[0];
    if (!form) return;

    let input = document.querySelector('#qtdeItensPagina') as HTMLInputElement | HTMLSelectElement | null;
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.id = 'qtdeItensPagina';
      input.name = 'qtdeItensPagina';
      form.appendChild(input);
    }
    input.value = String(valor);
  }, quantidade);
}

async function esperarTurnstile(page: Page, timeoutMs = 15000): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const token = await page.evaluate(
      () => (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
    );
    if (token && token.length > 10) return;
    await page.waitForTimeout(500);
  }
  console.warn('[Scraper] Turnstile não resolvido no tempo esperado — tentando mesmo assim.');
}

export async function buscarJurisprudencia(filtros: BuscaFiltros): Promise<RespostaBusca> {
  const filtrosNormalizados = normalizarCampoPesquisa(filtros);
  const ctx = await getBrowser();
  const page = await ctx.newPage();

  try {
    console.log('[Scraper] Carregando PROJUDI...');
    await page.goto(PROJUDI_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aguarda o campo de texto estar disponível
    await page.waitForSelector('#Texto', { timeout: 20000 });

    // Aguarda o Cloudflare Turnstile resolver
    await esperarTurnstile(page);

    // Preenche os filtros
    if (filtrosNormalizados.texto) {
      await page.fill('#Texto', filtrosNormalizados.texto);
    }
    if (filtrosNormalizados.instancia) {
      await selecionarPorLabel(page, '#Id_Instancia', filtrosNormalizados.instancia);
    }
    if (filtrosNormalizados.area) {
      await selecionarPorLabel(page, '#Id_Area', filtrosNormalizados.area);
    }
    if (filtrosNormalizados.orgaoMateria) {
      await selecionarPorLabel(page, '#Id_ServentiaSubTipo', filtrosNormalizados.orgaoMateria);
    }
    await preencherCampoTexto(page, '#Serventia', filtrosNormalizados.unidade, '#Id_Serventia', filtrosNormalizados.unidadeId);
    await preencherCampoTexto(page, '#Usuario', filtrosNormalizados.magistrado, '#Id_Usuario', filtrosNormalizados.magistradoId);
    await preencherCampoTexto(page, '#ArquivoTipo', filtrosNormalizados.tipoAto, '#Id_ArquivoTipo', filtrosNormalizados.tipoAtoId);
    if (filtrosNormalizados.numeroProcesso) {
      await page.fill('#ProcessoNumero', filtrosNormalizados.numeroProcesso);
    }
    if (filtrosNormalizados.dataInicial) {
      await page.fill('#DataInicial', filtrosNormalizados.dataInicial);
    }
    if (filtrosNormalizados.dataFinal) {
      await page.fill('#DataFinal', filtrosNormalizados.dataFinal);
    }
    await definirQuantidadePorPagina(page, filtrosNormalizados.quantidade);

    // Submete via a função JS nativa do PROJUDI (0-based: página 1 = índice 0)
    const pageIndex = (filtrosNormalizados.pagina ?? 1) - 1;
    console.log(`[Scraper] Submetendo busca (página ${pageIndex + 1})...`);
    await page.evaluate(`submitForm(${pageIndex})`);

    // Aguarda os resultados aparecerem (document.body pode ser null durante a navegação)
    await page.waitForFunction(
      () => document.body?.innerText?.includes('RESULTADOS ENCONTRADOS') ?? false,
      { timeout: 60000 }
    );

    // Extrai os dados da página
    const dados = await page.evaluate(() => {
      // Cabeçalho de total/tempo
      const bodyText = document.body.innerText;
      const totalMatch = bodyText.match(/(\d[\d.]+)\s+RESULTADOS ENCONTRADOS/);
      const tempoMatch = bodyText.match(/Tempo de resposta:\s*\(([^)]+)\)/);

      const total = totalMatch ? parseInt(totalMatch[1].replace(/\./g, ''), 10) : 0;
      const tempo = tempoMatch ? tempoMatch[1] : '';

      // Cada resultado — o PROJUDI exibe em blocos
      // Estrutura detectada: número, unidade, magistrado, tipoAto, data publicação, texto
      const resultados: Array<{
        numeroProcesso: string;
        unidade: string;
        magistrado: string;
        tipoAto: string;
        dataPublicacao: string;
        textoDecisao: string;
        linkInteiroTeor: string;
      }> = [];

      // Os resultados ficam em elementos com links "Baixar Inteiro teor"
      const linksInteiroTeor = document.querySelectorAll('a[href*="DownloadArquivoPublico"], a[href*="inteiro"], a[title*="Inteiro"], a[title*="inteiro"]');

      // Abordagem alternativa: parse pelo texto estruturado
      // Cada bloco começa com número de processo e termina antes do próximo
      const rows = document.querySelectorAll('[class*="resultado"], [class*="juris-item"], tr');

      // Fallback: parse direto do texto da página por padrão
      // O PROJUDI renderiza cada resultado como: nº processo | link | Unidade | Magistrado | TipoAto | Data | Texto
      const allLinks = Array.from(document.querySelectorAll('a')).filter(
        a => a.innerText.includes('Baixar Inteiro teor') || a.href.includes('DownloadArquivoPublico')
      );

      // Tenta pegar o container pai de cada resultado
      allLinks.forEach(link => {
        const container = link.closest('div, tr, li, section') ??
                          link.parentElement?.parentElement?.parentElement;
        if (!container) return;

        const texto = (container as HTMLElement).innerText ?? '';
        const linhas: string[] = texto.split('\n').map((l: string) => l.trim()).filter(Boolean);

        // Linha 0: número do processo (remove lixo de botões)
        const rawNum = linhas[0] ?? '';
        const numMatch = rawNum.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
        const numProcesso = numMatch ? numMatch[0] : '';
        // Linha 1 (após "Baixar Inteiro teor  Copiar"): unidade
        const unidadeIdx = linhas.findIndex((l: string) => l.length > 10 && !l.includes('Baixar') && !l.includes('Copiar') && linhas.indexOf(l) > 0);
        const unidade = linhas[unidadeIdx] ?? '';
        const magistrado = linhas[unidadeIdx + 1] ?? '';
        const tipoAto = linhas[unidadeIdx + 2] ?? '';
        const dataPublicacao = linhas.find((l: string) => /Publicado em/i.test(l)) ?? '';
        const textoIdx = linhas.findIndex((l: string) => /Publicado em/i.test(l));
        const textoDecisao = linhas.slice(textoIdx + 1).join('\n').slice(0, 2000);

        if (numProcesso && /\d{7}-\d{2}\.\d{4}/.test(numProcesso)) {
          resultados.push({
            numeroProcesso: numProcesso,
            unidade,
            magistrado,
            tipoAto,
            dataPublicacao: dataPublicacao.replace(/Publicado em/i, '').trim(),
            textoDecisao,
            linkInteiroTeor: '',
          });
        }
      });

      return { total, tempo, resultados };
    });

    console.log(`[Scraper] ${dados.total} resultados encontrados, extraídos ${dados.resultados.length}`);

    return {
      total: dados.total,
      tempoResposta: dados.tempo,
      resultados: dados.resultados as ResultadoJurisprudencia[],
      pagina: filtrosNormalizados.pagina ?? 1,
    };
  } finally {
    await page.close();
  }
}
