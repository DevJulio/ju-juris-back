export interface BuscaFiltros {
  texto?: string;
  campoPesquisa?: string; // compatibilidade com campo do sistema antigo
  instancia?: string;   // 'Todas as instâncias' | '1o Grau' | 'Turma de Uniformização / Turmas Recursais' | 'Tribunal'
  area?: string;        // 'Todas as áreas' | 'Cível' | 'Criminal'
  orgaoMateria?: string;
  unidade?: string;
  unidadeId?: string;
  magistrado?: string;
  magistradoId?: string;
  tipoAto?: string;
  tipoAtoId?: string;
  numeroProcesso?: string;
  dataInicial?: string; // dd/mm/aaaa
  dataFinal?: string;   // dd/mm/aaaa
  pagina?: number;
  quantidade?: number;  // 10 | 20 | 50
}

export interface ResultadoJurisprudencia {
  numeroProcesso: string;
  unidade: string;
  magistrado: string;
  tipoAto: string;
  dataPublicacao: string;
  textoDecisao: string;
  linkInteiroTeor?: string;
}

export interface RespostaBusca {
  total: number;
  tempoResposta: string;
  resultados: ResultadoJurisprudencia[];
  pagina: number;
}
