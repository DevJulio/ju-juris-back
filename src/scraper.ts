import { Page } from 'playwright';
import { getBrowser } from './browser';
import type { BuscaFiltros, RespostaBusca, ResultadoJurisprudencia } from './types';

const PROJUDI_URL = 'https://projudi.tjgo.jus.br/ConsultaJurisprudencia';

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
    if (filtros.texto) {
      await page.fill('#Texto', filtros.texto);
    }
    if (filtros.instancia) {
      await page.selectOption('#Id_Instancia', { label: filtros.instancia });
    }
    if (filtros.area) {
      await page.selectOption('#Id_Area', { label: filtros.area });
    }
    if (filtros.orgaoMateria) {
      await page.selectOption('#Id_ServentiaSubTipo', { label: filtros.orgaoMateria });
    }
    if (filtros.numeroProcesso) {
      await page.fill('#ProcessoNumero', filtros.numeroProcesso);
    }
    if (filtros.dataInicial) {
      await page.fill('#DataInicial', filtros.dataInicial);
    }
    if (filtros.dataFinal) {
      await page.fill('#DataFinal', filtros.dataFinal);
    }

    // Submete via a função JS nativa do PROJUDI (0-based: página 1 = índice 0)
    const pageIndex = (filtros.pagina ?? 1) - 1;
    console.log(`[Scraper] Submetendo busca (página ${pageIndex + 1})...`);
    await page.evaluate(`submitForm(${pageIndex})`);

    // Aguarda os resultados aparecerem
    await page.waitForFunction(
      () => document.body.innerText.includes('RESULTADOS ENCONTRADOS'),
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

        const texto = container.innerText ?? '';
        const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

        // Linha 0: número do processo (remove lixo de botões)
        const rawNum = linhas[0] ?? '';
        const numMatch = rawNum.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
        const numProcesso = numMatch ? numMatch[0] : '';
        // Linha 1 (após "Baixar Inteiro teor  Copiar"): unidade
        const unidadeIdx = linhas.findIndex(l => l.length > 10 && !l.includes('Baixar') && !l.includes('Copiar') && linhas.indexOf(l) > 0);
        const unidade = linhas[unidadeIdx] ?? '';
        const magistrado = linhas[unidadeIdx + 1] ?? '';
        const tipoAto = linhas[unidadeIdx + 2] ?? '';
        const dataPublicacao = linhas.find(l => /Publicado em/i.test(l)) ?? '';
        const textoIdx = linhas.findIndex(l => /Publicado em/i.test(l));
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
      pagina: filtros.pagina ?? 1,
    };
  } finally {
    await page.close();
  }
}
