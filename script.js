//CONFIGURAÇÕES E CONSTANTES DO JOGO (mude os números aqui)
const LARGURA = 800;
const ALTURA_DA_TELA = 450;
const Y_DO_CHAO = 400;
const LARGURA_PLATAFORMA = 140;
const CENTRO_PLATAFORMA = 450;
const EMPUXO_DO_MOTOR = 8;
const ACELERACAO_LATERAL = 12;
const CONSUMO_POR_SEGUNDO = 6;
const VELOCIDADE_MAXIMA_PARA_POUSAR = 6.5;
const DIFERENCA_MAXIMA_ENTRE_VELOCIDADES_X = 7;
const DESBLOQUEAR_TUDO = false;

//CONFIGURAÇÃO DOS NÍVEIS
const niveis = [
  { nome: 'Missão de Treinamento', gravidade: 1.5, amplitude: 0,  omega: 0,    descricao: 'Plataforma parada. Treine a descida suave.' },
  { nome: 'Órbita Instável', gravidade: 2, amplitude: 65, omega: 0.25,  descricao: 'A plataforma se move devagar. Iguale a velocidade horizontal.' },
  { nome: 'Pouso de Precisão', gravidade: 3, amplitude: 90, omega: 0.3, descricao: 'Gravidade alta e plataforma rápida. Exige precisão.' }
];

const tela = document.getElementById('tela');
const pincel = tela.getContext('2d');
const mensagem = document.getElementById('mensagem');

let numeroDoNivel = 0;
let nivel;                   
let tempo = 0, terminou = false;
let posicaoX, velocidadeX;         
let altura, velocidade, aceleracao;
let combustivel, motorLigado;
let emJogo = false;  
let temporizadorResultado;
const teclas = { cima: false, esquerda: false, direita: false };

//SISTEMA DE PROGRESSO (níveis concluídos)
const CHAVE_PROGRESSO = 'pousoLunar_concluidos';
function carregarProgresso() {
  try { return JSON.parse(localStorage.getItem(CHAVE_PROGRESSO)) || []; } catch (erro) { return []; }
}
function salvarProgresso() {
  try { localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(concluidos)); } catch (erro) { /* sem armazenamento */ }
}
let concluidos = carregarProgresso();
function nivelLiberado(i) {
  return DESBLOQUEAR_TUDO || i === 0 || concluidos[i - 1] === true;
}

//MATEMÁTICA DA PLATAFORMA (CÁLCULO DIFERENCIAL)

//POSIÇÃO DA PLATAFORMA
function posicaoPlataforma(t) {
  return CENTRO_PLATAFORMA + nivel.amplitude * Math.sin(nivel.omega * t);
}

//PRIMEIRA DERIVADA - VELOCIDADE
function velocidadePlataforma(t) {
  return nivel.amplitude * nivel.omega * Math.cos(nivel.omega * t);
}

//NAVEGAÇÃO ENTRE AS TELAS
function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  emJogo = (id === 'telaJogo');
  fecharResultado();
  window.scrollTo(0, 0);
}

//SELEÇÃO E INICIALIZAÇÃO DOS NÍVEIS
let nivelSelecionado = null;
function abrirNiveis() {
  const proximo = niveis.findIndex((n, i) => nivelLiberado(i) && !concluidos[i]);
  nivelSelecionado = proximo === -1 ? 0 : proximo;
  desenharListaNiveis();
  mostrarTela('telaNiveis');
}

function selecionarNivel(i) {
  nivelSelecionado = i;
  desenharListaNiveis();
}

function desenharListaNiveis() {
  const lista = document.getElementById('listaNiveis');
  lista.innerHTML = '';
  niveis.forEach((n, i) => {
    const liberado = nivelLiberado(i);
    const concluido = concluidos[i] === true;
    const botao = document.createElement('button');
    botao.className = 'cartao-nivel' + (liberado ? '' : ' bloqueado') + (concluido ? ' concluido' : '') + (i === nivelSelecionado ? ' selecionado' : '');
    botao.disabled = !liberado;
    const status = !liberado ? '🔒 BLOQUEADO' : concluido ? '✔ CONCLUÍDO' : '● DISPONÍVEL';
    botao.innerHTML =
      '<span class="num">NÍVEL 0' + (i + 1) + '</span>' +
      '<h3>' + n.nome + '</h3>' +
      '<span class="dificuldade">' + '★'.repeat(i + 1) + '☆'.repeat(niveis.length - i - 1) + '</span>' +
      '<span class="status">' + status + '</span>';
    botao.onclick = () => selecionarNivel(i);
    lista.appendChild(botao);
  });
  mostrarDetalhes();
}

function mostrarDetalhes() {
  const n = niveis[nivelSelecionado];
  document.getElementById('detalheNome').textContent = n.nome;
  document.getElementById('detalheDescricao').textContent = n.descricao;
  const plataforma = n.amplitude === 0
    ? 'parada'
    : '±' + n.amplitude + ' m (vel. máx. ' + (n.amplitude * n.omega).toFixed(1) + ' m/s)';
  document.getElementById('detalheAtributos').innerHTML =
    '<li><span>Gravidade</span>' + n.gravidade + ' m/s²</li>' +
    '<li><span>Plataforma</span>' + plataforma + '</li>' +
    '<li><span>Combustível</span>100%</li>';
}

function iniciarSelecionado() {
  mostrarTela('telaJogo');
  iniciar(nivelSelecionado);
}

function iniciar(numero) {
  clearTimeout(temporizadorResultado);
  fecharResultado();
  if (document.activeElement) document.activeElement.blur();
  numeroDoNivel = numero;
  nivel = niveis[numero];
  tempo = 0;
  terminou = false;
  posicaoX = 120;
  velocidadeX = 0;
  altura = 250;
  velocidade = 0;
  aceleracao = -nivel.gravidade;
  combustivel = 100;
  motorLigado = false;
  document.getElementById('tituloNivel').textContent = 'NÍVEL 0' + (numero + 1) + ' · ' + nivel.nome;
  mensagem.textContent = 'Pouse devagar na plataforma e iguale a velocidade horizontal dela!';
}

//CONTROLE DO FOGUETE (motor e combustível)
function controlarMotor(dt) {
  motorLigado = teclas.cima && combustivel > 0;
  if (!motorLigado) return 0;
  combustivel = Math.max(0, combustivel - CONSUMO_POR_SEGUNDO * dt);
  return EMPUXO_DO_MOTOR;
}

//MOVIMENTAÇÃO E ATUALIZAÇÃO DA FÍSICA
function atualizar(dt) {
  tempo += dt;
  const empuxo = controlarMotor(dt);

  // a massa diminui com o combustível, então a aceleração NÃO é constante
  const massa = 1 + combustivel / 100;
  aceleracao = empuxo / massa - nivel.gravidade;

  // movimento lateral (setas ← e →)
  let aceleracaoX = 0;
  if (teclas.esquerda) aceleracaoX = -ACELERACAO_LATERAL;
  if (teclas.direita)  aceleracaoX = ACELERACAO_LATERAL;

  // MATEMÁTICA: ACELERAÇÃO, VELOCIDADE E POSIÇÃO
  velocidade += aceleracao * dt;
  altura += velocidade * dt;
  velocidadeX += aceleracaoX * dt;
  posicaoX += velocidadeX * dt;
  posicaoX = Math.max(20, Math.min(LARGURA - 20, posicaoX));

  if (altura <= 0) {
    altura = 0;
    terminou = true;
    verificarPouso();
  }
}

//VERIFICAÇÃO DAS CONDIÇÕES DE POUSO
function verificarPouso() {
  const velocidadeRelativa = velocidadeX - velocidadePlataforma(tempo);
  const naPlataforma = Math.abs(posicaoX - posicaoPlataforma(tempo)) < LARGURA_PLATAFORMA / 2;
  const descidaSuave = Math.abs(velocidade) <= VELOCIDADE_MAXIMA_PARA_POUSAR;
  const velocidadesIguais = Math.abs(velocidadeRelativa) <= DIFERENCA_MAXIMA_ENTRE_VELOCIDADES_X;

  if (naPlataforma && descidaSuave && velocidadesIguais) {
    concluidos[numeroDoNivel] = true;
    salvarProgresso();
    mensagem.textContent = '✅ Pouso perfeito!';
    agendarResultado(true, 'Você concluiu o nível ' + (numeroDoNivel + 1) + ' com velocidade vertical de ' + velocidade.toFixed(2) + ' m/s.');
  } else {
    let motivo = '';
    if (!naPlataforma) motivo += 'Fora da plataforma. ';
    if (!descidaSuave) motivo += 'Descida rápida demais. ';
    if (!velocidadesIguais) motivo += 'Velocidade horizontal diferente da plataforma. ';
    mensagem.textContent = '💥 ' + motivo;
    agendarResultado(false, motivo + 'Tente de novo!');
  }
}

//SISTEMA DE RESULTADOS
function agendarResultado(sucesso, texto) {
  temporizadorResultado = setTimeout(() => mostrarResultado(sucesso, texto), 700);
}

function mostrarResultado(sucesso, texto) {
  document.getElementById('resultadoTitulo').textContent = sucesso ? '🚀 Pouso perfeito!' : '💥 Pouso não concluído';
  document.getElementById('resultadoTexto').textContent = texto;
  const temProximo = sucesso && numeroDoNivel < niveis.length - 1;
  document.getElementById('botaoProximo').style.display = temProximo ? '' : 'none';
  document.getElementById('resultado').classList.add('mostrar');
}

function fecharResultado() {
  document.getElementById('resultado').classList.remove('mostrar');
}

//DESENHO DO CENÁRIO E DO FOGUETE (parte 1: cenário e plataforma)
const estrelasDoJogo = [];
for (let i = 0; i < 70; i++) {
  estrelasDoJogo.push({ x: (i * 137) % LARGURA, y: (i * 71) % 330, tamanho: 1 + (i % 3) * 0.6, brilho: 0.25 + (i % 5) * 0.14 });
}
const crateras = [
  { x: 90, largura: 46, altura: 7 }, { x: 260, largura: 30, altura: 5 }, { x: 420, largura: 60, altura: 8 },
  { x: 700, largura: 40, altura: 6 }, { x: 350, largura: 22, altura: 4 }, { x: 770, largura: 24, altura: 4 }
];

function desenharSeta(x, y, tamanhoX, tamanhoY, cor, rotulo) {
  pincel.strokeStyle = cor;
  pincel.fillStyle = cor;
  pincel.lineWidth = 3;
  pincel.beginPath();
  pincel.moveTo(x, y);
  pincel.lineTo(x + tamanhoX, y + tamanhoY);
  pincel.stroke();
  pincel.beginPath();
  pincel.arc(x + tamanhoX, y + tamanhoY, 4, 0, Math.PI * 2);
  pincel.fill();
  pincel.font = '11px monospace';
  pincel.fillText(rotulo, x + tamanhoX + 8, y + tamanhoY - 6);
}

function desenharFundoDoJogo() {
  pincel.fillStyle = '#ffffff';
  for (const estrela of estrelasDoJogo) {
    pincel.globalAlpha = estrela.brilho;
    pincel.fillRect(estrela.x, estrela.y, estrela.tamanho, estrela.tamanho);
  }
  pincel.globalAlpha = 1;

  const degrade = pincel.createLinearGradient(0, Y_DO_CHAO, 0, ALTURA_DA_TELA);
  degrade.addColorStop(0, '#5b6879');
  degrade.addColorStop(1, '#1d2734');
  pincel.fillStyle = degrade;
  pincel.fillRect(0, Y_DO_CHAO, LARGURA, ALTURA_DA_TELA - Y_DO_CHAO);
  pincel.fillStyle = '#8795a6';
  pincel.fillRect(0, Y_DO_CHAO, LARGURA, 2);
  crateras.forEach((c, i) => {
    pincel.beginPath();
    pincel.ellipse(c.x, Y_DO_CHAO + 16 + (i % 3) * 10, c.largura / 2, c.altura / 2, 0, 0, Math.PI * 2);
    pincel.fillStyle = 'rgba(15, 22, 32, 0.55)';
    pincel.fill();
    pincel.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    pincel.lineWidth = 1;
    pincel.stroke();
  });
}

function desenharPlataforma() {
  const xPlataforma = posicaoPlataforma(tempo);   
  const esquerda = xPlataforma - LARGURA_PLATAFORMA / 2;
  pincel.shadowColor = '#58e6ff';
  pincel.shadowBlur = 14;
  pincel.fillStyle = '#58e6ff';
  pincel.fillRect(esquerda, Y_DO_CHAO - 6, LARGURA_PLATAFORMA, 6);
  pincel.shadowBlur = 0;
  pincel.fillStyle = Math.floor(performance.now() / 400) % 2 ? '#ffb454' : '#7a5a2a';
  pincel.fillRect(esquerda + 4, Y_DO_CHAO - 10, 6, 4);
  pincel.fillRect(esquerda + LARGURA_PLATAFORMA - 10, Y_DO_CHAO - 10, 6, 4);
  desenharSeta(xPlataforma, Y_DO_CHAO - 24, velocidadePlataforma(tempo) * 3, 0, '#ffb454', 'v plat.');
}

//DESENHO DO CENÁRIO E DO FOGUETE (parte 2: foguete, feito direto no Canvas)
function desenharFoguete() {
  const x = posicaoX;
  const y = Y_DO_CHAO - altura;

  desenharChama(x, y);
  desenharAletas(x, y);
  desenharBocal(x, y);
  desenharCorpo(x, y);

  desenharSeta(x, y - 25, velocidadeX * 3, -velocidade * 3, '#6cf2a5', 'v');
}

function desenharChama(x, y) {
  if (!motorLigado || terminou) return;
  const tamanhoChama = 20 + Math.random() * 10;
  pincel.fillStyle = '#ff6c42';
  pincel.beginPath();
  pincel.moveTo(x - 7, y + 2);
  pincel.quadraticCurveTo(x - 6, y + tamanhoChama * 0.6, x, y + tamanhoChama);
  pincel.quadraticCurveTo(x + 6, y + tamanhoChama * 0.6, x + 7, y + 2);
  pincel.fill();
  pincel.fillStyle = '#ffe08a';
  pincel.beginPath();
  pincel.moveTo(x - 3, y + 2);
  pincel.quadraticCurveTo(x - 3, y + tamanhoChama * 0.4, x, y + tamanhoChama * 0.6);
  pincel.quadraticCurveTo(x + 3, y + tamanhoChama * 0.4, x + 3, y + 2);
  pincel.fill();
}

function desenharAletas(x, y) {
  pincel.fillStyle = '#ff647c';
  for (const lado of [-1, 1]) {   
    pincel.beginPath();
    pincel.moveTo(x + lado * 11, y - 20);
    pincel.quadraticCurveTo(x + lado * 22, y - 10, x + lado * 22, y);
    pincel.lineTo(x + lado * 11, y - 2);
    pincel.closePath();
    pincel.fill();
  }
}

function desenharBocal(x, y) {
  pincel.fillStyle = '#55606d';
  pincel.beginPath();
  pincel.moveTo(x - 6, y - 1);
  pincel.lineTo(x + 6, y - 1);
  pincel.lineTo(x + 8, y + 3);
  pincel.lineTo(x - 8, y + 3);
  pincel.closePath();
  pincel.fill();
}

function desenharCorpo(x, y) {
  pincel.save();
  pincel.beginPath();
  pincel.moveTo(x, y - 50);
  pincel.quadraticCurveTo(x + 13, y - 34, x + 12, y - 10);
  pincel.lineTo(x + 12, y);
  pincel.lineTo(x - 12, y);
  pincel.lineTo(x - 12, y - 10);
  pincel.quadraticCurveTo(x - 13, y - 34, x, y - 50);
  pincel.closePath();
  pincel.clip();                      
  pincel.fillStyle = '#e8f1f9';          
  pincel.fillRect(x - 13, y - 52, 26, 54);
  pincel.fillStyle = 'rgba(0, 0, 0, 0.1)'; 
  pincel.fillRect(x + 5, y - 52, 8, 54);
  pincel.fillStyle = '#ff647c';           
  pincel.fillRect(x - 13, y - 52, 26, 16);
  pincel.fillRect(x - 13, y - 5, 26, 3);   
  pincel.restore();

  pincel.fillStyle = '#2b3a4d';
  pincel.beginPath();
  pincel.arc(x, y - 26, 6.5, 0, Math.PI * 2);
  pincel.fill();
  pincel.fillStyle = '#58e6ff';
  pincel.beginPath();
  pincel.arc(x, y - 26, 4.8, 0, Math.PI * 2);
  pincel.fill();
  pincel.fillStyle = 'rgba(255, 255, 255, 0.7)';
  pincel.beginPath();
  pincel.arc(x - 1.6, y - 27.6, 1.4, 0, Math.PI * 2);
  pincel.fill();
}

function desenhar() {
  pincel.clearRect(0, 0, LARGURA, ALTURA_DA_TELA);
  desenharFundoDoJogo();
  desenharPlataforma();
  desenharFoguete();
}

// TELEMETRIA (painel de números)
function mostrarTelemetria() {
  const velocidadeRelativa = velocidadeX - velocidadePlataforma(tempo);
  document.getElementById('txtAltura').textContent = altura.toFixed(1) + ' m';
  document.getElementById('txtVelocidade').textContent = velocidade.toFixed(2) + ' m/s';
  document.getElementById('txtAceleracao').textContent = aceleracao.toFixed(2) + ' m/s²';
  document.getElementById('txtCombustivel').textContent = Math.round(combustivel) + '%';
  document.getElementById('barraCombustivel').style.width = combustivel + '%';
  document.getElementById('txtVelPlataforma').textContent = velocidadePlataforma(tempo).toFixed(2) + ' m/s';
  document.getElementById('txtVelRelativa').textContent = velocidadeRelativa.toFixed(2) + ' m/s';
  document.getElementById('metricaVelocidade').classList.toggle('alerta', Math.abs(velocidade) > VELOCIDADE_MAXIMA_PARA_POUSAR);
  document.getElementById('metricaRelativa').classList.toggle('ok', Math.abs(velocidadeRelativa) <= DIFERENCA_MAXIMA_ENTRE_VELOCIDADES_X);
}

// LAÇO PRINCIPAL DO JOGO
let tempoAnterior = performance.now();

function laco(agora) {
  const dt = Math.min((agora - tempoAnterior) / 1000, 0.05);   // segundos (máx. 0,05)
  tempoAnterior = agora;
  if (emJogo) {
    if (!terminou) atualizar(dt);
    desenhar();
    mostrarTelemetria();
  }
  requestAnimationFrame(laco);
}

// CONTROLES DO TECLADO 
function mudarTecla(evento, apertada) {
  if (!emJogo) return;
  const tecla = evento.key.toLowerCase();
  if (tecla === 'arrowup') teclas.cima = apertada;
  if (tecla === 'arrowleft') teclas.esquerda = apertada;
  if (tecla === 'arrowright') teclas.direita = apertada;
  if (apertada && tecla === 'r') iniciar(numeroDoNivel);
  if (['arrowup', 'arrowleft', 'arrowright'].includes(tecla)) evento.preventDefault();
}
window.addEventListener('keydown', e => mudarTecla(e, true));
window.addEventListener('keyup', e => mudarTecla(e, false));
window.addEventListener('blur', () => { teclas.cima = teclas.esquerda = teclas.direita = false; });

//INICIALIZAÇÃO DO JOGO
const sombrasDasEstrelas = [];
for (let i = 0; i < 120; i++) {
  const x = Math.random() * 100, y = Math.random() * 100;
  const espessura = Math.random() < 0.2 ? 1 : 0;
  const brilho = (0.3 + Math.random() * 0.6).toFixed(2);
  sombrasDasEstrelas.push(x.toFixed(1) + 'vw ' + y.toFixed(1) + 'vh 0 ' + espessura + 'px rgba(255,255,255,' + brilho + ')');
}
document.getElementById('estrelas').style.boxShadow = sombrasDasEstrelas.join(',');

function ligarBotao(id, acao) {
  document.getElementById(id).addEventListener('click', acao);
}
ligarBotao('botaoIniciar', iniciarSelecionado);
ligarBotao('botaoNiveisJogo', abrirNiveis);
ligarBotao('botaoReiniciar', () => iniciar(numeroDoNivel));
ligarBotao('botaoProximo', () => iniciar(numeroDoNivel + 1));
ligarBotao('botaoTentarDeNovo', () => iniciar(numeroDoNivel));
ligarBotao('botaoNiveisResultado', abrirNiveis);

nivel = niveis[0];
iniciar(0);
abrirNiveis();
requestAnimationFrame(laco);
