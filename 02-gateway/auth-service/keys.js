const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Las llaves viven en un volumen montado (ver docker-compose: auth_keys)
// para que sobrevivan a un rebuild del contenedor. Si el contenedor se
// recrea sin ese volumen, se genera un par nuevo -- por eso el volumen
// es importante, no un detalle.
const KEYS_DIR = process.env.KEYS_DIR || path.join(__dirname, 'keys');
const CURRENT_FILE = path.join(KEYS_DIR, 'current.json');

function asegurarCarpeta() {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
}

function generarPar() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const kid = crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(KEYS_DIR, `${kid}.private.pem`), privateKey);
  fs.writeFileSync(path.join(KEYS_DIR, `${kid}.public.pem`), publicKey);
  return kid;
}

// Se llama una vez al arrancar. Si ya hay llaves (volumen persistente),
// no genera nada nuevo -- por eso los tokens siguen siendo validos
// despues de un `docker compose up` normal.
function inicializarClaves() {
  asegurarCarpeta();
  if (!fs.existsSync(CURRENT_FILE)) {
    const kid = generarPar();
    fs.writeFileSync(CURRENT_FILE, JSON.stringify({ kid }));
    console.log(`auth-service: par RSA generado (kid=${kid})`);
  } else {
    const { kid } = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8'));
    console.log(`auth-service: usando llave existente (kid=${kid})`);
  }
}

// La llave "actual" es la que se usa para FIRMAR tokens nuevos.
function obtenerClaveActual() {
  const { kid } = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8'));
  const privateKey = fs.readFileSync(path.join(KEYS_DIR, `${kid}.private.pem`), 'utf8');
  return { kid, privateKey };
}

// El JWKS expone TODAS las llaves publicas presentes en la carpeta,
// no solo la actual. Asi, si rotan la llave, los tokens viejos firmados
// con la anterior siguen siendo verificables hasta que expiren.
function construirJWKS() {
  asegurarCarpeta();
  const archivos = fs.readdirSync(KEYS_DIR).filter((f) => f.endsWith('.public.pem'));

  const keys = archivos.map((archivo) => {
    const kid = archivo.replace('.public.pem', '');
    const pem = fs.readFileSync(path.join(KEYS_DIR, archivo), 'utf8');
    const jwk = crypto.createPublicKey(pem).export({ format: 'jwk' });
    return { ...jwk, kid, use: 'sig', alg: 'RS256' };
  });

  return { keys };
}

// Genera una llave nueva y la marca como la que se usa para firmar
// de ahora en adelante. Las llaves anteriores se quedan en el JWKS
// (no se borran) para poder verificar tokens ya emitidos.
function rotarClave() {
  const kid = generarPar();
  fs.writeFileSync(CURRENT_FILE, JSON.stringify({ kid }));
  console.log(`auth-service: llave rotada (kid=${kid})`);
  return kid;
}

module.exports = { inicializarClaves, obtenerClaveActual, construirJWKS, rotarClave };
