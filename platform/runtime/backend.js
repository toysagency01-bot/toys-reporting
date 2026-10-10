var __defProp = Object.defineProperty;
var __name = (target, value2) => __defProp(target, "name", { value: value2, configurable: true });

// src/staging-entrypoint.js
import { WorkerEntrypoint } from "cloudflare:workers";

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var strictDecoder = new TextDecoder("utf-8", { fatal: true });
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0), buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers)
    buf.set(buffer, i), i += buffer.length;
  return buf;
}
__name(concat, "concat");
var NON_ASCII = /[^\x00-\x7f]/;
function encode(string) {
  if (typeof string == "string" && string.length >= 128) {
    if (NON_ASCII.test(string))
      throw new TypeError("non-ASCII string encountered in encode()");
    return encoder.encode(string);
  }
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127)
      throw new TypeError("non-ASCII string encountered in encode()");
    bytes[i] = code;
  }
  return bytes;
}
__name(encode, "encode");
function decodeBase64(encoded, url = false) {
  if (Uint8Array.fromBase64)
    return Uint8Array.fromBase64(encoded, { alphabet: url ? "base64url" : "base64" });
  if (url) {
    if (encoded.includes("+") || encoded.includes("/"))
      throw new TypeError("Invalid base64url");
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  }
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(decodeBase64, "decodeBase64");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options), this.name = this.constructor.name, Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static {
    __name(this, "JWTExpired");
  }
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWKSInvalid = class extends JOSEError {
  static {
    __name(this, "JWKSInvalid");
  }
  static code = "ERR_JWKS_INVALID";
  code = "ERR_JWKS_INVALID";
};
var JWKSNoMatchingKey = class extends JOSEError {
  static {
    __name(this, "JWKSNoMatchingKey");
  }
  static code = "ERR_JWKS_NO_MATCHING_KEY";
  code = "ERR_JWKS_NO_MATCHING_KEY";
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSMultipleMatchingKeys = class extends JOSEError {
  static {
    __name(this, "JWKSMultipleMatchingKeys");
  }
  [Symbol.asyncIterator] = async function* () {
  };
  static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSTimeout = class extends JOSEError {
  static {
    __name(this, "JWKSTimeout");
  }
  static code = "ERR_JWKS_TIMEOUT";
  code = "ERR_JWKS_TIMEOUT";
  constructor(message2 = "request timed out", options) {
    super(message2, options);
  }
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/util/base64url.js
var invalid = "The input to be decoded is not correctly encoded.";
function decode(input) {
  try {
    return decodeBase64(typeof input == "string" ? input : decoder.decode(input), true);
  } catch (cause) {
    throw new TypeError(invalid, { cause });
  }
}
__name(decode, "decode");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/validate.js
function isObject(input) {
  if (typeof input != "object" || input === null || Object.prototype.toString.call(input) !== "[object Object]")
    return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}
__name(isObject, "isObject");
function isJwkSet(input) {
  return isObject(input) && Array.isArray(input.keys) && Array.from(input.keys).every(isObject);
}
__name(isJwkSet, "isJwkSet");
function isDisjoint(...headers) {
  const parameters = /* @__PURE__ */ new Set();
  for (const header of headers)
    if (header)
      for (const parameter of Object.keys(header)) {
        if (parameters.has(parameter))
          return false;
        parameters.add(parameter);
      }
  return true;
}
__name(isDisjoint, "isDisjoint");
function decodeBase64url(value2, label, ErrorClass) {
  try {
    return decode(value2);
  } catch {
    throw new ErrorClass(`Failed to base64url decode the ${label}`);
  }
}
__name(decodeBase64url, "decodeBase64url");
function encodeBase64url(value2, label, ErrorClass) {
  try {
    return encode(value2);
  } catch {
    throw new ErrorClass(`The ${label} is not a valid base64url string`);
  }
}
__name(encodeBase64url, "encodeBase64url");
function parseJoseHeader(b64, ErrorClass, message2) {
  let parsed;
  try {
    parsed = JSON.parse(strictDecoder.decode(decode(b64)));
  } catch {
    throw new ErrorClass(message2);
  }
  if (!isObject(parsed))
    throw new ErrorClass(message2);
  return parsed;
}
__name(parseJoseHeader, "parseJoseHeader");
var JWS_RECOGNIZED = { __proto__: null, b64: true };
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s != "string")))
    throw new TypeError(`"${option}" option must be an array of strings`);
  return algorithms === void 0 ? void 0 : new Set(algorithms);
}
__name(validateAlgorithms, "validateAlgorithms");
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0)
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!protectedHeader || protectedHeader.crit === void 0)
    return [];
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input != "string" || input.length === 0))
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  const recognized = recognizedOption === void 0 ? recognizedDefault : { __proto__: null, ...recognizedOption, ...recognizedDefault };
  for (const parameter of protectedHeader.crit) {
    if (!(parameter in recognized))
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    if (!Object.hasOwn(joseHeader, parameter) || joseHeader[parameter] === void 0)
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    if (recognized[parameter] && (!Object.hasOwn(protectedHeader, parameter) || protectedHeader[parameter] === void 0))
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
  }
  return protectedHeader.crit;
}
__name(validateCrit, "validateCrit");
function validateB64(protectedHeader, extensions) {
  if (extensions.includes("b64")) {
    const b64 = protectedHeader.b64;
    if (typeof b64 != "boolean")
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    return b64;
  }
  return true;
}
__name(validateB64, "validateB64");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/key.js
var tag = /* @__PURE__ */ __name((key) => key[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((entry, key, usage) => {
  const { alg } = entry;
  if (key.use !== void 0) {
    const expected = usage === "sign" || usage === "verify" ? "sig" : "enc";
    if (key.use !== expected)
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
  }
  if (key.alg !== void 0 && key.alg !== alg)
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  if (Array.isArray(key.key_ops)) {
    const expectedKeyOp = usage === "encrypt" || usage === "decrypt" ? entry.ops?.[usage === "encrypt" ? 0 : 1] : usage;
    if (expectedKeyOp && !key.key_ops.includes(expectedKeyOp))
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
  }
}, "jwkMatchesOp");
async function prepareKey(entry, key, usage) {
  const { alg, secret } = entry, privateKey = usage === "decrypt" || usage === "sign";
  if (secret && key instanceof Uint8Array)
    return key;
  let normalized, keyObject;
  if (isObject(key)) {
    if (normalized = normalizeJwk(key), typeof normalized.kty != "string")
      throw invalidKeyType(alg, key, secret);
    if (!(secret ? normalized.kty === "oct" && typeof normalized.k == "string" : normalized.kty !== "oct" && (privateKey ? normalized.kty === "AKP" && typeof normalized.priv == "string" || typeof normalized.d == "string" : normalized.d === void 0 && normalized.priv === void 0)))
      throw new TypeError(secret ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : `JSON Web Key for this operation must be a ${privateKey ? "private" : "public"} JWK`);
    if (jwkMatchesOp(entry, normalized, usage), normalized.kty === "oct")
      return decode(normalized.k);
    if (!Object.isFrozen(key)) {
      const { key_ops } = key;
      Array.isArray(key_ops) && Object.freeze(key_ops), Object.freeze(key);
    }
  } else {
    if (!isKeyLike(key))
      throw invalidKeyType(alg, key, secret);
    const expectedType = secret ? "secret" : privateKey ? "private" : "public";
    if (key.type !== expectedType && (secret || ["secret", "public", "private"].includes(key.type)))
      throw new TypeError(`${tag(key)} instances must be of type "${expectedType}" for the ${alg} algorithm`);
    if (isCryptoKey(key))
      return key;
    if (keyObject = key, keyObject.type === "secret")
      return keyObject.export();
  }
  cache ||= /* @__PURE__ */ new WeakMap();
  const cacheKey2 = key;
  let cached = cache.get(cacheKey2);
  if (cached?.[alg])
    return cached[alg];
  if (cached || cache.set(cacheKey2, cached = {}), keyObject && typeof keyObject.toCryptoKey == "function") {
    const isPublic = keyObject.type === "public", crv = nist[keyObject.asymmetricKeyDetails?.namedCurve], params = entry.resolve?.({ crv, asymmetricKeyType: keyObject.asymmetricKeyType }) ?? entry.subtle;
    return cached[alg] = keyObject.toCryptoKey(params, isPublic, entry.usages[isPublic ? 0 : 1]);
  }
  return normalized ??= keyObject.export({ format: "jwk" }), normalized.alg = alg, cached[alg] = await jwkToKey(entry, normalized);
}
__name(prepareKey, "prepareKey");
var cache;
var nist = {
  __proto__: null,
  prime256v1: "P-256",
  secp384r1: "P-384",
  secp521r1: "P-521"
};
var isCryptoKey = /* @__PURE__ */ __name((key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
}, "isCryptoKey");
var isKeyObject = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
var isKeyLike = /* @__PURE__ */ __name((key) => isCryptoKey(key) || isKeyObject(key), "isKeyLike");
function message(msg, actual, ...types) {
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else types.length === 2 ? msg += `one of type ${types[0]} or ${types[1]}.` : msg += `of type ${types[0]}.`;
  return actual == null ? msg += ` Received ${actual}` : typeof actual == "function" && actual.name ? msg += ` Received function ${actual.name}` : typeof actual == "object" && actual != null && actual.constructor?.name && (msg += ` Received an instance of ${actual.constructor.name}`), msg;
}
__name(message, "message");
function invalidKeyType(alg, actual, secret) {
  const types = ["CryptoKey", "KeyObject", "JSON Web Key"];
  return secret && types.push("Uint8Array"), new TypeError(message(`Key for the ${alg} algorithm must be `, actual, ...types));
}
__name(invalidKeyType, "invalidKeyType");
var unusable = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage))
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
}
__name(checkUsage, "checkUsage");
function checkModulusLength(alg, key) {
  const { modulusLength } = key.algorithm;
  if (typeof modulusLength != "number" || modulusLength < 2048)
    throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
}
__name(checkModulusLength, "checkModulusLength");
function checkCryptoKey(key, expected, usage) {
  const algorithm = key.algorithm;
  if (algorithm.name !== expected.name)
    throw unusable(expected.name);
  if (expected.hash && algorithm.hash?.name !== expected.hash)
    throw unusable(expected.hash, "algorithm.hash");
  if (expected.namedCurve && algorithm.namedCurve !== expected.namedCurve)
    throw unusable(expected.namedCurve, "algorithm.namedCurve");
  if (expected.length !== void 0 && algorithm.length !== expected.length)
    throw unusable(expected.length, "algorithm.length");
  checkUsage(key, usage);
}
__name(checkCryptoKey, "checkCryptoKey");
function snapshotJwk(jwk) {
  return { __proto__: null, ...jwk };
}
__name(snapshotJwk, "snapshotJwk");
function normalizeJwk(jwk) {
  const normalized = snapshotJwk(jwk);
  if (normalized.ext !== void 0 && typeof normalized.ext != "boolean")
    throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
  if (normalized.key_ops !== void 0) {
    const value2 = normalized.key_ops, keyOps = Array.isArray(value2) ? [...value2] : void 0;
    if (!keyOps || keyOps.some((operation) => typeof operation != "string") || new Set(keyOps).size !== keyOps.length)
      throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
    normalized.key_ops = keyOps;
  }
  return normalized;
}
__name(normalizeJwk, "normalizeJwk");
async function jwkToKey(entry, jwk, extractable) {
  if (!entry.kty.includes(jwk.kty))
    throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  const algorithm = entry.resolve?.({ kty: jwk.kty, crv: jwk.crv }) ?? entry.subtle, isPrivate = !!(jwk.d || jwk.priv), keyData = { ...jwk, ext: extractable ?? jwk.ext };
  return keyData.kty !== "AKP" && delete keyData.alg, delete keyData.use, crypto.subtle.importKey("jwk", keyData, algorithm, keyData.ext ?? !isPrivate, jwk.key_ops ?? entry.usages[isPrivate ? 1 : 0]);
}
__name(jwkToKey, "jwkToKey");
async function rawKey(key, expected, usage, extractable = false) {
  return key instanceof Uint8Array && (key = await crypto.subtle.importKey("raw", key, expected, extractable, [usage])), checkCryptoKey(key, expected, usage), key;
}
__name(rawKey, "rawKey");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/key_descriptor.js
function table(entries) {
  const out = { __proto__: null };
  for (const alg in entries)
    out[alg] = { ...entries[alg], alg };
  return out;
}
__name(table, "table");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/jws_algorithms.js
var sig = [["verify"], ["sign"]];
function hmac(bits) {
  const subtle = { name: "HMAC", hash: `SHA-${bits}` };
  return { kty: ["oct"], secret: true, subtle, signing: subtle, usages: sig };
}
__name(hmac, "hmac");
function rsa(bits, saltLength) {
  const subtle = { name: saltLength ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: `SHA-${bits}` };
  return {
    kty: ["RSA"],
    subtle,
    signing: saltLength ? { ...subtle, saltLength } : subtle,
    usages: sig,
    minRsaBits: 2048
  };
}
__name(rsa, "rsa");
function ecdsa(crv, bits) {
  return {
    kty: ["EC"],
    crv,
    subtle: { name: "ECDSA", namedCurve: crv },
    signing: { name: "ECDSA", hash: `SHA-${bits}` },
    usages: sig
  };
}
__name(ecdsa, "ecdsa");
function eddsa() {
  const subtle = { name: "Ed25519" };
  return {
    kty: ["OKP"],
    crv: "Ed25519",
    subtle,
    signing: subtle,
    usages: sig
  };
}
__name(eddsa, "eddsa");
function mldsa(bits) {
  const subtle = { name: `ML-DSA-${bits}` };
  return {
    kty: ["AKP"],
    subtle,
    signing: subtle,
    usages: sig
  };
}
__name(mldsa, "mldsa");
var JWS = table({
  HS256: hmac(256),
  HS384: hmac(384),
  HS512: hmac(512),
  RS256: rsa(256),
  RS384: rsa(384),
  RS512: rsa(512),
  PS256: rsa(256, 32),
  PS384: rsa(384, 48),
  PS512: rsa(512, 64),
  ES256: ecdsa("P-256", 256),
  ES384: ecdsa("P-384", 384),
  ES512: ecdsa("P-521", 512),
  EdDSA: eddsa(),
  Ed25519: eddsa(),
  "ML-DSA-44": mldsa(44),
  "ML-DSA-65": mldsa(65),
  "ML-DSA-87": mldsa(87)
});
function jwsAlgorithm(alg) {
  const entry = typeof alg == "string" ? JWS[alg] : void 0;
  if (!entry)
    throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  return entry;
}
__name(jwsAlgorithm, "jwsAlgorithm");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/jws_verify.js
function prepareVerify(options) {
  return [options && validateAlgorithms("algorithms", options.algorithms), options?.crit];
}
__name(prepareVerify, "prepareVerify");
function parseProtectedHeader(encodedProtected) {
  return encodedProtected === void 0 ? {} : parseJoseHeader(encodedProtected, JWSInvalid, "JWS Protected Header is invalid");
}
__name(parseProtectedHeader, "parseProtectedHeader");
function encodeCompactUnencodedPayload(payload) {
  try {
    return encode(payload);
  } catch {
    throw new JWSInvalid("JWS Compact Serialization payload must use only ASCII characters");
  }
}
__name(encodeCompactUnencodedPayload, "encodeCompactUnencodedPayload");
async function verifySignature(jws, shared, key, encodeUnencodedPayload, parsedProtected) {
  const { protected: encodedProtected, header, payload: inputPayload } = jws, parsedProt = parsedProtected ?? parseProtectedHeader(encodedProtected);
  if (!isDisjoint(parsedProt, header))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...parsedProt, ...header }, b64 = validateB64(parsedProt, validateCrit(JWSInvalid, JWS_RECOGNIZED, shared[1], parsedProt, joseHeader)), { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  if (shared[0] && !shared[0].has(alg))
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  if (b64) {
    if (typeof inputPayload != "string")
      throw new JWSInvalid("JWS Payload must be a string");
  } else if (typeof inputPayload != "string" && !(inputPayload instanceof Uint8Array))
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  const signingPayload = b64 || typeof inputPayload != "string" ? inputPayload : encodeUnencodedPayload(inputPayload);
  let resolvedKey = false;
  typeof key == "function" && (key = await key(parsedProt, jws), resolvedKey = true);
  const entry = jwsAlgorithm(alg), data = concat(encodedProtected !== void 0 ? encode(encodedProtected) : new Uint8Array(), encode("."), typeof signingPayload == "string" ? shared[2] ??= encodeBase64url(signingPayload, "payload", JWSInvalid) : signingPayload), signature = decodeBase64url(jws.signature, "signature", JWSInvalid), k = await prepareKey(entry, key, "verify"), cryptoKey = await rawKey(k, entry.subtle, "verify");
  entry.minRsaBits && checkModulusLength(entry.alg, cryptoKey);
  let verified = false;
  try {
    verified = await crypto.subtle.verify(entry.signing, cryptoKey, signature, data);
  } catch {
  }
  if (!verified)
    throw new JWSSignatureVerificationFailed();
  const result = { payload: typeof signingPayload == "string" ? decodeBase64url(signingPayload, "payload", JWSInvalid) : signingPayload };
  return encodedProtected !== void 0 && (result.protectedHeader = parsedProt), header !== void 0 && (result.unprotectedHeader = header), resolvedKey ? [{ ...result, key: k }, b64] : [result, b64];
}
__name(verifySignature, "verifySignature");
async function verifyCompact(jws, shared, key) {
  if (jws instanceof Uint8Array && (jws = decoder.decode(jws)), typeof jws != "string")
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3)
    throw new JWSInvalid("Invalid Compact JWS");
  return verifySignature({ payload, protected: protectedHeader, signature }, shared, key, encodeCompactUnencodedPayload);
}
__name(verifyCompact, "verifyCompact");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = /* @__PURE__ */ __name((date2) => Math.floor(date2.getTime() / 1e3), "epoch");
var multipliers = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31557600
};
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var checkFailed = "check_failed";
function invalidDuration() {
  throw new TypeError("Invalid time period format");
}
__name(invalidDuration, "invalidDuration");
function secs(str) {
  typeof str != "string" && invalidDuration();
  const matched = REGEX.exec(str);
  (!matched || matched[4] && matched[1]) && invalidDuration();
  const value2 = parseFloat(matched[2]), numericDate2 = Math.round(value2 * multipliers[matched[3][0].toLowerCase()]);
  return Number.isFinite(numericDate2) || invalidDuration(), matched[1] === "-" || matched[4] === "ago" ? -numericDate2 : numericDate2;
}
__name(secs, "secs");
function validateInput(label, input) {
  if (!Number.isFinite(input))
    throw new TypeError(`Invalid ${label} input`);
  return input;
}
__name(validateInput, "validateInput");
var normalizeTyp = /* @__PURE__ */ __name((value2) => {
  const normalized = value2.toLowerCase();
  return value2.includes("/") ? normalized : `application/${normalized}`;
}, "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => typeof audPayload == "string" ? audOption.includes(audPayload) : Array.isArray(audPayload) ? audOption.some((aud) => audPayload.includes(aud)) : false, "checkAudiencePresence");
function validateNumericDate(payload, claim, required = false) {
  const value2 = payload[claim];
  if (!(value2 === void 0 && !required)) {
    if (typeof value2 != "number")
      throw new JWTClaimValidationFailed(`"${claim}" claim must be a number`, payload, claim, "invalid");
    return value2;
  }
}
__name(validateNumericDate, "validateNumericDate");
function unexpectedClaim(payload, claim) {
  throw new JWTClaimValidationFailed(`unexpected "${claim}" claim value`, payload, claim, checkFailed);
}
__name(unexpectedClaim, "unexpectedClaim");
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(strictDecoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload))
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  const { typ } = options;
  if (typ !== void 0 && (typeof protectedHeader.typ != "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ)))
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", checkFailed);
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options, presenceCheck = [...requiredClaims];
  maxTokenAge !== void 0 && presenceCheck.push("iat"), audience !== void 0 && presenceCheck.push("aud"), subject !== void 0 && presenceCheck.push("sub"), issuer !== void 0 && presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse()))
    if (!Object.hasOwn(payload, claim))
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
  issuer !== void 0 && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss) && unexpectedClaim(payload, "iss"), subject !== void 0 && payload.sub !== subject && unexpectedClaim(payload, "sub"), audience !== void 0 && !checkAudiencePresence(payload.aud, typeof audience == "string" ? [audience] : audience) && unexpectedClaim(payload, "aud");
  const { clockTolerance } = options;
  let tolerance = 0;
  if (typeof clockTolerance == "string")
    tolerance = secs(clockTolerance);
  else if (clockTolerance !== void 0) {
    if (typeof clockTolerance != "number")
      throw new TypeError("Invalid clockTolerance option type");
    tolerance = clockTolerance;
  }
  validateInput("clockTolerance option", tolerance);
  const { currentDate } = options, now = validateInput("currentDate option", epoch(currentDate === void 0 ? /* @__PURE__ */ new Date() : currentDate)), iat = validateNumericDate(payload, "iat", maxTokenAge !== void 0), nbf = validateNumericDate(payload, "nbf");
  if (nbf !== void 0 && nbf > now + tolerance)
    throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", checkFailed);
  const exp = validateNumericDate(payload, "exp");
  if (exp !== void 0 && exp <= now - tolerance)
    throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", checkFailed);
  if (maxTokenAge !== void 0) {
    const age = now - iat, max = validateInput("maxTokenAge option", typeof maxTokenAge == "number" ? maxTokenAge : secs(maxTokenAge));
    if (age - tolerance > max)
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", checkFailed);
    if (age < -tolerance)
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", checkFailed);
  }
  return payload;
}
__name(validateClaimsSet, "validateClaimsSet");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const [verified, b64] = await verifyCompact(jwt, prepareVerify(options), key);
  if (!b64)
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  return { ...verified, payload };
}
__name(jwtVerify, "jwtVerify");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/jwks/local.js
function isUsableJWK(jwk, entry, alg, kid) {
  const { kty, key_ops: keyOps, ext, kid: jwkKid, alg: jwkAlg, use, crv } = jwk;
  return (ext === void 0 || typeof ext == "boolean") && (keyOps === void 0 || Array.isArray(keyOps) && keyOps.every((operation, index) => typeof operation == "string" && keyOps.indexOf(operation) === index) && keyOps.includes("verify")) && entry.kty.includes(kty) && (kid === void 0 || typeof kid == "string" && kid === jwkKid) && (jwkAlg === void 0 ? kty !== "AKP" : alg === jwkAlg) && (use === void 0 || use === "sig") && (!entry.crv || crv === entry.crv);
}
__name(isUsableJWK, "isUsableJWK");
async function importWithAlgCache(cache2, jwk, entry) {
  const cached = cache2.get(jwk) || cache2.set(jwk, {}).get(jwk), { alg } = entry;
  if (cached[alg] === void 0) {
    const pending = jwkToKey(entry, jwk, true).then((key) => {
      if (key.type !== "public")
        throw new JWKSInvalid("JSON Web Key Set members must be public keys");
      return cached[alg] = key, key;
    }).catch((error) => {
      throw cached[alg] === pending && delete cached[alg], error;
    });
    cached[alg] = pending;
  }
  return cached[alg];
}
__name(importWithAlgCache, "importWithAlgCache");
function createLocalJWKSet(jwks) {
  let snapshot;
  try {
    snapshot = structuredClone(jwks);
  } catch {
  }
  if (!isJwkSet(snapshot))
    throw new JWKSInvalid("JSON Web Key Set malformed");
  const metadata = snapshot.keys.map((jwk) => {
    const normalized = snapshotJwk(jwk);
    return Array.isArray(normalized.key_ops) && (normalized.key_ops = [...normalized.key_ops]), normalized;
  }), cached = /* @__PURE__ */ new WeakMap();
  return Object.defineProperty(async (protectedHeader, token) => {
    const { alg, kid } = { ...protectedHeader, ...token?.header }, entry = typeof alg == "string" ? JWS[alg] : void 0;
    if (!entry || entry.secret)
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
    const candidates = snapshot.keys.filter((_, index) => isUsableJWK(metadata[index], entry, alg, kid)), { 0: jwk, length } = candidates;
    if (!length)
      throw new JWKSNoMatchingKey();
    if (length !== 1) {
      const error = new JWKSMultipleMatchingKeys();
      throw error[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates)
          try {
            yield await importWithAlgCache(cached, jwk2, entry);
          } catch {
          }
      }, error;
    }
    return importWithAlgCache(cached, jwk, entry);
  }, "jwks", {
    value: /* @__PURE__ */ __name(() => structuredClone(snapshot), "value")
  });
}
__name(createLocalJWKSet, "createLocalJWKSet");

// node_modules/.pnpm/jose@6.2.12/node_modules/jose/dist/webapi/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair < "u" || typeof navigator < "u" && true || typeof EdgeRuntime < "u" && EdgeRuntime === "vercel";
}
__name(isCloudflareWorkers, "isCloudflareWorkers");
var USER_AGENT;
(typeof navigator > "u" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) && (USER_AGENT = "jose/v6.2.12");
var customFetch = /* @__PURE__ */ Symbol();
async function fetchJwks(url, headers, signal, fetchImpl = fetch) {
  const response5 = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "manual",
    headers
  }).catch((err) => {
    throw err.name === "TimeoutError" ? new JWKSTimeout() : err;
  });
  if (response5.status !== 200)
    throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
  try {
    return await response5.json();
  } catch {
    throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}
__name(fetchJwks, "fetchJwks");
var jwksCache = /* @__PURE__ */ Symbol();
function isFreshFor(timestamp, duration) {
  return Number.isFinite(timestamp) && Date.now() < timestamp + duration;
}
__name(isFreshFor, "isFreshFor");
function validateDuration(value2, fallback, option) {
  if (Number.isNaN(value2))
    throw new TypeError(`"${option}" option must not be NaN`);
  return typeof value2 == "number" ? value2 : fallback;
}
__name(validateDuration, "validateDuration");
function createRemoteJWKSet(url, options) {
  if (!(url instanceof URL))
    throw new TypeError("url must be an instance of URL");
  const href = new URL(url.href).href, opts = options ?? {}, timeoutOption = opts.timeoutDuration;
  if (typeof timeoutOption == "number" && (!Number.isInteger(timeoutOption) || timeoutOption < 0))
    throw new TypeError('"timeoutDuration" option must be a non-negative integer');
  const timeoutDuration = typeof timeoutOption == "number" ? timeoutOption : 5e3, cooldownDuration = validateDuration(opts.cooldownDuration, 3e4, "cooldownDuration"), cacheMaxAge = validateDuration(opts.cacheMaxAge, 6e5, "cacheMaxAge"), headers = new Headers(opts.headers);
  USER_AGENT && !headers.has("User-Agent") && headers.set("User-Agent", USER_AGENT), headers.has("accept") || headers.set("accept", "application/json, application/jwk-set+json");
  const fetchImpl = opts[customFetch], cache2 = opts[jwksCache];
  let jwksTimestamp, pendingFetch, reloadSequence = 0, appliedSequence = 0, local;
  if (cache2 && typeof cache2 == "object") {
    const { uat, jwks } = cache2;
    isFreshFor(uat, cacheMaxAge) && isJwkSet(jwks) && (jwksTimestamp = uat, local = createLocalJWKSet(jwks));
  }
  const reload = /* @__PURE__ */ __name(async () => {
    if (pendingFetch && isCloudflareWorkers() && (pendingFetch = void 0), !pendingFetch) {
      const sequence = ++reloadSequence, current = pendingFetch = fetchJwks(href, headers, AbortSignal.timeout(timeoutDuration), fetchImpl).then((json2) => {
        const next = createLocalJWKSet(json2);
        if (sequence <= appliedSequence)
          return;
        local = next;
        const updatedAt = Date.now();
        cache2 && (cache2.uat = updatedAt, cache2.jwks = json2), jwksTimestamp = updatedAt, appliedSequence = sequence;
      }).finally(() => {
        pendingFetch === current && (pendingFetch = void 0);
      });
    }
    await pendingFetch;
  }, "reload");
  return Object.defineProperties(async (protectedHeader, token) => {
    (!local || !isFreshFor(jwksTimestamp, cacheMaxAge)) && await reload();
    try {
      return await local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey && !isFreshFor(jwksTimestamp, cooldownDuration))
        return await reload(), local(protectedHeader, token);
      throw err;
    }
  }, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => isFreshFor(jwksTimestamp, cooldownDuration), "get"),
      enumerable: true
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => isFreshFor(jwksTimestamp, cacheMaxAge), "get"),
      enumerable: true
    },
    reload: {
      value: reload,
      enumerable: true
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => !!pendingFetch, "get"),
      enumerable: true
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => local?.jwks(), "value"),
      enumerable: true
    }
  });
}
__name(createRemoteJWKSet, "createRemoteJWKSet");

// src/content-comments.js
var JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
__name(response, "response");
async function parseBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}
__name(parseBody, "parseBody");
async function sha256Text(value2) {
  const bytes = new TextEncoder().encode(value2);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Text, "sha256Text");
function protectedContext(auth, project, item) {
  const organizationId = String(project?.organizationId || "");
  const projectId = String(project?.id || "");
  const subject = String(auth?.subject || "").trim();
  if (!auth?.ok || !subject || subject === "public-read") {
    return { ok: false, status: 403, error: "protected_auth_required" };
  }
  if (!organizationId || !projectId || !item?.id || item.organizationId !== organizationId || item.projectId !== projectId) {
    return { ok: false, status: 404, error: "content_item_scope_mismatch" };
  }
  if (subject.length > 500) return { ok: false, status: 400, error: "invalid_author" };
  return { ok: true, organizationId, projectId, subject };
}
__name(protectedContext, "protectedContext");
function validateCommentBody(body) {
  if (!body || typeof body.body !== "string") return { ok: false, error: "comment_body_required" };
  const value2 = body.body.trim();
  if (!value2) return { ok: false, error: "comment_body_required" };
  if (value2.length > 3e3) return { ok: false, error: "comment_body_too_large" };
  const requestedRevisionId = body.publishedRevisionId == null ? body.publishedRevisionId : String(body.publishedRevisionId).trim();
  if (requestedRevisionId === "") return { ok: false, error: "invalid_published_revision" };
  const expectedDataReleaseId = body.expectedDataReleaseId == null ? null : String(body.expectedDataReleaseId).trim();
  if (body.expectedDataReleaseId != null && !expectedDataReleaseId) {
    return { ok: false, error: "invalid_data_release" };
  }
  return { ok: true, body: value2, requestedRevisionId, expectedDataReleaseId };
}
__name(validateCommentBody, "validateCommentBody");
async function storedIdempotency(env, project, action, key, requestHash) {
  const row = await env.TOYS_DB.prepare(
    `SELECT request_hash AS requestHash, response_json AS responseJson
       FROM api_idempotency_keys
      WHERE organization_id = ? AND project_id = ? AND action = ? AND idempotency_key = ?`
  ).bind(project.organizationId, project.id, action, key).first();
  if (!row) return null;
  return row.requestHash === requestHash ? { conflict: false, response: JSON.parse(row.responseJson) } : { conflict: true, response: null };
}
__name(storedIdempotency, "storedIdempotency");
async function currentRelease(env, project) {
  return env.TOYS_DB.prepare(
    `SELECT r.id, r.revision, r.source_hash AS sourceHash, r.created_at AS createdAt
       FROM project_data_release_pointers p
       JOIN project_data_releases r
         ON r.organization_id = p.organization_id
        AND r.project_id = p.project_id
        AND r.id = p.release_id
      WHERE p.organization_id = ? AND p.project_id = ?`
  ).bind(project.organizationId, project.id).first();
}
__name(currentRelease, "currentRelease");
async function publishedRevision(env, project, item, requestedRevisionId) {
  const revisionId = requestedRevisionId === void 0 ? item.publishedRevisionId || null : requestedRevisionId;
  if (revisionId == null) return { ok: true, revision: null };
  if (revisionId !== item.publishedRevisionId) {
    return { ok: false, status: 409, error: "published_revision_changed" };
  }
  const revision = await env.TOYS_DB.prepare(
    `SELECT r.id, r.revision_number AS revisionNumber
       FROM content_items i
       JOIN content_revisions r
         ON r.organization_id = i.organization_id
        AND r.project_id = i.project_id
        AND r.content_item_id = i.id
        AND r.id = i.published_revision_id
      WHERE i.organization_id = ? AND i.project_id = ? AND i.id = ?
        AND r.id = ? AND r.status = 'published'`
  ).bind(project.organizationId, project.id, item.id, revisionId).first();
  return revision ? { ok: true, revision } : { ok: false, status: 409, error: "published_revision_not_found" };
}
__name(publishedRevision, "publishedRevision");
function commentModel(row) {
  return {
    id: row.id,
    contentItemId: row.contentItemId,
    dataReleaseId: row.dataReleaseId,
    publishedRevisionId: row.publishedRevisionId || null,
    authorRef: row.authorRef,
    body: row.body,
    createdAt: row.createdAt
  };
}
__name(commentModel, "commentModel");
async function listContentComments(request, env, auth, project, item) {
  const context = protectedContext(auth, project, item);
  if (!context.ok) return response({ ok: false, error: context.error }, context.status);
  const url = new URL(request.url);
  const orderValue = String(url.searchParams.get("order") || "newest");
  const chronological = orderValue === "chronological" || orderValue === "oldest";
  if (!chronological && orderValue !== "newest") {
    return response({ ok: false, error: "invalid_order" }, 400);
  }
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue == null ? 100 : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return response({ ok: false, error: "invalid_limit" }, 400);
  }
  const direction = chronological ? "ASC" : "DESC";
  const rows = await env.TOYS_DB.prepare(
    `SELECT id, content_item_id AS contentItemId, data_release_id AS dataReleaseId,
            published_revision_id AS publishedRevisionId, author_ref AS authorRef,
            body, created_at AS createdAt
       FROM content_comments
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ?
      ORDER BY created_at ${direction}, id ${direction}
      LIMIT ?`
  ).bind(project.organizationId, project.id, item.id, limit).all();
  return response({
    ok: true,
    contentItemId: item.id,
    order: chronological ? "chronological" : "newest",
    comments: (rows.results || []).map(commentModel)
  });
}
__name(listContentComments, "listContentComments");
async function createContentComment(request, env, auth, project, item) {
  const context = protectedContext(auth, project, item);
  if (!context.ok) return response({ ok: false, error: context.error }, context.status);
  const body = await parseBody(request);
  if (!body) return response({ ok: false, error: "invalid_json" }, 400);
  const validated = validateCommentBody(body);
  if (!validated.ok) return response({ ok: false, error: validated.error }, 400);
  const idempotencyKey2 = String(request.headers.get("x-idempotency-key") || body.idempotencyKey || "");
  if (idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    return response({ ok: false, error: "idempotency_key_required" }, 400);
  }
  const action = `content-comment-create:${item.id}`;
  const requestHash = await sha256Text(JSON.stringify({
    contentItemId: item.id,
    body: validated.body,
    publishedRevisionId: validated.requestedRevisionId === void 0 ? item.publishedRevisionId || null : validated.requestedRevisionId,
    expectedDataReleaseId: validated.expectedDataReleaseId
  }));
  const stored = await storedIdempotency(env, project, action, idempotencyKey2, requestHash);
  if (stored?.conflict) return response({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response(stored.response, 201);
  const release = await currentRelease(env, project);
  if (!release) return response({ ok: false, error: "no_published_release" }, 409);
  if (validated.expectedDataReleaseId && release.id !== validated.expectedDataReleaseId) {
    return response({ ok: false, error: "data_release_changed", currentDataReleaseId: release.id }, 409);
  }
  const revisionResult = await publishedRevision(env, project, item, validated.requestedRevisionId);
  if (!revisionResult.ok) return response({ ok: false, error: revisionResult.error }, revisionResult.status);
  const comment = {
    id: crypto.randomUUID(),
    contentItemId: item.id,
    dataReleaseId: release.id,
    publishedRevisionId: revisionResult.revision?.id || null,
    authorRef: context.subject,
    body: validated.body,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const resultBody = { ok: true, comment };
  const statements = [
    env.TOYS_DB.prepare(
      `INSERT INTO content_comments
        (id, organization_id, project_id, content_item_id, data_release_id,
         published_revision_id, author_ref, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      comment.id,
      project.organizationId,
      project.id,
      item.id,
      release.id,
      comment.publishedRevisionId,
      comment.authorRef,
      comment.body,
      comment.createdAt
    ),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys
        (organization_id, project_id, action, idempotency_key, request_hash, response_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(project.organizationId, project.id, action, idempotencyKey2, requestHash, JSON.stringify(resultBody))
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.[1]?.meta?.changes || 0) !== 1) {
      throw new Error("comment_create_failed");
    }
  } catch (_) {
    const raced = await storedIdempotency(env, project, action, idempotencyKey2, requestHash);
    if (raced?.conflict) return response({ ok: false, error: "idempotency_key_reuse" }, 409);
    if (raced) return response(raced.response, 201);
    return response({ ok: false, error: "comment_create_failed" }, 500);
  }
  return response(resultBody, 201);
}
__name(createContentComment, "createContentComment");

// src/creative-storage-quota.js
var CreativeStorageQuotaError = class extends Error {
  static {
    __name(this, "CreativeStorageQuotaError");
  }
  constructor(code) {
    super(code);
    this.name = "CreativeStorageQuotaError";
    this.code = code;
  }
};
function fail(code) {
  throw new CreativeStorageQuotaError(code);
}
__name(fail, "fail");
function nowIso(now) {
  const value2 = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value2.getTime())) fail("invalid_clock");
  return value2.toISOString();
}
__name(nowIso, "nowIso");
function positiveInteger(value2, code) {
  const number = Number(value2);
  if (!Number.isSafeInteger(number) || number <= 0) fail(code);
  return number;
}
__name(positiveInteger, "positiveInteger");
async function first(db, sql, args) {
  return db.prepare(sql).bind(...args).first();
}
__name(first, "first");
async function run(db, sql, args) {
  return db.prepare(sql).bind(...args).run();
}
__name(run, "run");
function scoped(project) {
  const organizationId = String(project?.organizationId || "");
  const projectId = String(project?.id || "");
  if (!organizationId || !projectId) fail("project_scope_required");
  return { organizationId, projectId };
}
__name(scoped, "scoped");
function createCreativeStorageQuotaGuard({ db, now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now"), randomId = /* @__PURE__ */ __name(() => crypto.randomUUID(), "randomId") } = {}) {
  if (!db?.prepare) fail("db_required");
  async function usage(project, at = now()) {
    const scope = scoped(project);
    const timestamp = nowIso(at);
    const row = await first(
      db,
      `SELECT q.max_stored_bytes AS maxStoredBytes,
        q.max_object_bytes AS maxObjectBytes,
        COALESCE((SELECT SUM(o.actual_bytes) FROM creative_storage_objects o
          WHERE o.organization_id=q.organization_id AND o.project_id=q.project_id),0) AS storedBytes,
        COALESCE((SELECT SUM(r.reserved_bytes) FROM creative_storage_reservations r
          WHERE r.organization_id=q.organization_id AND r.project_id=q.project_id
            AND r.status='active' AND r.expires_at>?),0) AS reservedBytes
      FROM creative_storage_quotas q WHERE q.organization_id=? AND q.project_id=?`,
      [timestamp, scope.organizationId, scope.projectId]
    );
    if (!row) fail("storage_quota_not_configured");
    return {
      maxStoredBytes: Number(row.maxStoredBytes),
      maxObjectBytes: Number(row.maxObjectBytes),
      storedBytes: Number(row.storedBytes),
      reservedBytes: Number(row.reservedBytes),
      availableBytes: Math.max(0, Number(row.maxStoredBytes) - Number(row.storedBytes) - Number(row.reservedBytes))
    };
  }
  __name(usage, "usage");
  async function reserve({ project, creativeAssetId, bytes, ttlMinutes = 15 } = {}) {
    const scope = scoped(project);
    const requestedBytes = positiveInteger(bytes, "invalid_reservation_bytes");
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) fail("invalid_reservation_ttl");
    const createdAt = nowIso(now());
    const expiresAt = new Date(Date.parse(createdAt) + ttlMinutes * 6e4).toISOString();
    const id = String(randomId());
    await run(
      db,
      `UPDATE creative_storage_reservations SET status='released',finished_at=?
      WHERE organization_id=? AND project_id=? AND creative_asset_id=?
        AND status='active' AND expires_at<=?`,
      [createdAt, scope.organizationId, scope.projectId, creativeAssetId, createdAt]
    );
    const result = await run(
      db,
      `INSERT INTO creative_storage_reservations
        (id,organization_id,project_id,creative_asset_id,reserved_bytes,status,created_at,expires_at)
      SELECT ?,?,?,?,?, 'active',?,?
      FROM creative_storage_quotas q
      WHERE q.organization_id=? AND q.project_id=?
        AND ?<=q.max_object_bytes
        AND NOT EXISTS (SELECT 1 FROM creative_storage_objects o
          WHERE o.organization_id=q.organization_id AND o.project_id=q.project_id AND o.creative_asset_id=?)
        AND NOT EXISTS (SELECT 1 FROM creative_storage_reservations r
          WHERE r.organization_id=q.organization_id AND r.project_id=q.project_id
            AND r.creative_asset_id=? AND r.status='active' AND r.expires_at>?)
        AND (COALESCE((SELECT SUM(o.actual_bytes) FROM creative_storage_objects o
          WHERE o.organization_id=q.organization_id AND o.project_id=q.project_id),0)
          + COALESCE((SELECT SUM(r.reserved_bytes) FROM creative_storage_reservations r
            WHERE r.organization_id=q.organization_id AND r.project_id=q.project_id
              AND r.status='active' AND r.expires_at>?),0) + ?)<=q.max_stored_bytes`,
      [
        id,
        scope.organizationId,
        scope.projectId,
        creativeAssetId,
        requestedBytes,
        createdAt,
        expiresAt,
        scope.organizationId,
        scope.projectId,
        requestedBytes,
        creativeAssetId,
        creativeAssetId,
        createdAt,
        createdAt,
        requestedBytes
      ]
    );
    if (Number(result?.meta?.changes || 0) !== 1) {
      await usage(project, createdAt);
      fail("storage_quota_or_reservation_conflict");
    }
    return { id, creativeAssetId, reservedBytes: requestedBytes, createdAt, expiresAt };
  }
  __name(reserve, "reserve");
  async function authorizeOperation({ project, operationClass, operation, creativeAssetId = null, operationId } = {}) {
    const scope = scoped(project);
    if (!["class_a", "class_b"].includes(operationClass)) fail("invalid_operation_class");
    const name = String(operation || "").trim();
    const id = String(operationId || "").trim();
    if (!name || !id) fail("operation_identity_required");
    const createdAt = nowIso(now());
    const billingMonth = createdAt.slice(0, 7);
    const limitColumn = operationClass === "class_a" ? "max_monthly_class_a_ops" : "max_monthly_class_b_ops";
    const result = await run(
      db,
      `INSERT INTO creative_storage_operation_events
        (id,organization_id,project_id,billing_month,operation_class,operation,creative_asset_id,created_at)
      SELECT ?,?,?,?,?,?,?,? FROM creative_storage_quotas q
      WHERE q.organization_id=? AND q.project_id=?
        AND (SELECT COUNT(*) FROM creative_storage_operation_events e
          WHERE e.organization_id=q.organization_id AND e.project_id=q.project_id
            AND e.billing_month=? AND e.operation_class=?)<q.${limitColumn}`,
      [
        id,
        scope.organizationId,
        scope.projectId,
        billingMonth,
        operationClass,
        name,
        creativeAssetId,
        createdAt,
        scope.organizationId,
        scope.projectId,
        billingMonth,
        operationClass
      ]
    );
    if (Number(result?.meta?.changes || 0) !== 1) fail("storage_operation_budget_exhausted");
    return { id, billingMonth, operationClass, operation: name, createdAt };
  }
  __name(authorizeOperation, "authorizeOperation");
  async function commit({ project, reservationId, creativeAssetId, objectKey, actualBytes, etag = null } = {}) {
    const scope = scoped(project);
    const verifiedBytes = Number(actualBytes);
    if (!Number.isSafeInteger(verifiedBytes) || verifiedBytes < 0) fail("invalid_actual_bytes");
    const verifiedAt = nowIso(now());
    const objectId = String(randomId());
    const statements = [
      db.prepare(`INSERT INTO creative_storage_objects
          (id,organization_id,project_id,creative_asset_id,reservation_id,provider,object_key,actual_bytes,etag,verified_at)
        SELECT ?,?,?,?,?, 'r2',?,?,?,?
        FROM creative_storage_reservations r
        JOIN creative_storage_quotas q ON q.organization_id=r.organization_id AND q.project_id=r.project_id
        WHERE r.id=? AND r.organization_id=? AND r.project_id=? AND r.creative_asset_id=?
          AND r.status='active' AND r.expires_at>? AND ?>=0 AND ?<=r.reserved_bytes
          AND (COALESCE((SELECT SUM(o.actual_bytes) FROM creative_storage_objects o
            WHERE o.organization_id=q.organization_id AND o.project_id=q.project_id),0)
            + COALESCE((SELECT SUM(p.reserved_bytes) FROM creative_storage_reservations p
              WHERE p.organization_id=q.organization_id AND p.project_id=q.project_id
                AND p.status='active' AND p.expires_at>? AND p.id<>r.id),0) + ?)<=q.max_stored_bytes`).bind(
        objectId,
        scope.organizationId,
        scope.projectId,
        creativeAssetId,
        reservationId,
        objectKey,
        verifiedBytes,
        etag,
        verifiedAt,
        reservationId,
        scope.organizationId,
        scope.projectId,
        creativeAssetId,
        verifiedAt,
        verifiedBytes,
        verifiedBytes,
        verifiedAt,
        verifiedBytes
      ),
      db.prepare(`UPDATE creative_storage_reservations SET status='committed',finished_at=?
        WHERE id=? AND organization_id=? AND project_id=? AND status='active'
          AND EXISTS (SELECT 1 FROM creative_storage_objects o WHERE o.reservation_id=?)`).bind(verifiedAt, reservationId, scope.organizationId, scope.projectId, reservationId),
      db.prepare(`UPDATE creative_assets
        SET storage_provider='r2',storage_key=?,upload_state='ready',updated_at=?
        WHERE organization_id=? AND project_id=? AND id=?
          AND EXISTS (SELECT 1 FROM creative_storage_objects o
            WHERE o.organization_id=? AND o.project_id=? AND o.creative_asset_id=? AND o.reservation_id=?)`).bind(
        objectKey,
        verifiedAt,
        scope.organizationId,
        scope.projectId,
        creativeAssetId,
        scope.organizationId,
        scope.projectId,
        creativeAssetId,
        reservationId
      )
    ];
    const results = await db.batch(statements);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1 || Number(results?.[2]?.meta?.changes || 0) !== 1) {
      fail("storage_commit_rejected");
    }
    return { id: objectId, creativeAssetId, objectKey, actualBytes: verifiedBytes, etag, verifiedAt };
  }
  __name(commit, "commit");
  async function release({ project, reservationId } = {}) {
    const scope = scoped(project);
    const finishedAt = nowIso(now());
    const result = await run(
      db,
      `UPDATE creative_storage_reservations SET status='released',finished_at=?
      WHERE id=? AND organization_id=? AND project_id=? AND status='active'`,
      [finishedAt, reservationId, scope.organizationId, scope.projectId]
    );
    return { released: Number(result?.meta?.changes || 0) === 1, finishedAt };
  }
  __name(release, "release");
  return Object.freeze({ authorizeOperation, commit, release, reserve, usage });
}
__name(createCreativeStorageQuotaGuard, "createCreativeStorageQuotaGuard");

// src/creative-assets.js
var JSON_HEADERS2 = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
var MEDIA_TYPES = /* @__PURE__ */ new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["image/gif", "image"],
  ["video/mp4", "video"],
  ["video/webm", "video"],
  ["video/quicktime", "video"]
]);
var TRANSITIONS = /* @__PURE__ */ new Map([
  ["draft", /* @__PURE__ */ new Set(["in_review", "archived"])],
  ["in_review", /* @__PURE__ */ new Set(["draft", "approved", "rejected", "archived"])],
  ["approved", /* @__PURE__ */ new Set(["archived"])],
  ["rejected", /* @__PURE__ */ new Set(["draft", "in_review", "archived"])],
  ["archived", /* @__PURE__ */ new Set()]
]);
function response2(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS2 });
}
__name(response2, "response");
async function parseBody2(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}
__name(parseBody2, "parseBody");
async function sha256Text2(value2) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value2));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Text2, "sha256Text");
function scopedContext(auth, project, creative2 = null, requiredRole = "viewer") {
  const organizationId = String(project?.organizationId || "");
  const projectId = String(project?.id || "");
  const subject = String(auth?.subject || "").trim();
  if (!auth?.ok || !subject || subject === "public-read" || auth.role === "public") {
    return { ok: false, status: 403, error: "protected_auth_required" };
  }
  if (!organizationId || !projectId) return { ok: false, status: 404, error: "project_scope_mismatch" };
  if (auth.projectSlug && project?.slug && auth.projectSlug !== project.slug) {
    return { ok: false, status: 403, error: "project_scope_forbidden" };
  }
  if (requiredRole === "editor" && auth.role !== "editor") {
    return { ok: false, status: 403, error: "editor_role_required" };
  }
  if (subject.length > 500) return { ok: false, status: 400, error: "invalid_actor" };
  if (creative2 && (creative2.organizationId !== organizationId || creative2.projectId !== projectId)) {
    return { ok: false, status: 404, error: "creative_scope_mismatch" };
  }
  return { ok: true, organizationId, projectId, subject };
}
__name(scopedContext, "scopedContext");
function creativeModel(row) {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    mediaType: row.mediaType,
    byteSize: Number(row.byteSize),
    sha256: row.sha256,
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    durationMs: row.durationMs == null ? null : Number(row.durationMs),
    uploadState: row.uploadState,
    status: row.status,
    statusVersion: Number(row.statusVersion),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    preview: { available: row.uploadState === "ready", access: "protected" }
  };
}
__name(creativeModel, "creativeModel");
function objectStorage(env) {
  const bucket = env?.CREATIVE_MEDIA;
  return bucket && typeof bucket.put === "function" && typeof bucket.get === "function" ? bucket : null;
}
__name(objectStorage, "objectStorage");
function storageKey(project, creativeId) {
  return `organizations/${encodeURIComponent(project.organizationId)}/projects/${encodeURIComponent(project.id)}/creatives/${encodeURIComponent(creativeId)}/original`;
}
__name(storageKey, "storageKey");
function matchesMagic(mediaType, bytes) {
  const starts = /* @__PURE__ */ __name((...values) => values.every((value2, index) => bytes[index] === value2), "starts");
  if (mediaType === "image/jpeg") return starts(255, 216, 255);
  if (mediaType === "image/png") return starts(137, 80, 78, 71, 13, 10, 26, 10);
  if (mediaType === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (mediaType === "image/gif") return ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)));
  if (mediaType === "video/webm") return starts(26, 69, 223, 163);
  if (["video/mp4", "video/quicktime"].includes(mediaType)) return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return false;
}
__name(matchesMagic, "matchesMagic");
async function sha256Bytes(value2) {
  const digest = await crypto.subtle.digest("SHA-256", value2);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Bytes, "sha256Bytes");
function storageFailure(error) {
  if (!(error instanceof CreativeStorageQuotaError)) return response2({ ok: false, error: "object_storage_failed" }, 502);
  const status = error.code === "storage_operation_budget_exhausted" ? 429 : error.code === "storage_quota_or_reservation_conflict" ? 413 : 503;
  return response2({ ok: false, error: error.code }, status);
}
__name(storageFailure, "storageFailure");
function commentModel2(row) {
  return {
    id: row.id,
    creativeAssetId: row.creativeAssetId,
    authorRef: row.authorRef,
    body: row.body,
    createdAt: row.createdAt
  };
}
__name(commentModel2, "commentModel");
function validateMetadata(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_json" };
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const mediaType = typeof body.mediaType === "string" ? body.mediaType.trim().toLowerCase() : "";
  const byteSize = Number(body.byteSize);
  const checksum = typeof body.sha256 === "string" ? body.sha256.trim().toLowerCase() : "";
  if (!fileName || fileName.length > 255 || /[\u0000-\u001f]/.test(fileName)) {
    return { ok: false, error: "invalid_file_name" };
  }
  const kind = MEDIA_TYPES.get(mediaType);
  if (!kind) return { ok: false, error: "unsupported_media_type" };
  if (!Number.isSafeInteger(byteSize) || byteSize < 0) return { ok: false, error: "invalid_byte_size" };
  if (!/^[a-f0-9]{64}$/.test(checksum)) return { ok: false, error: "invalid_sha256" };
  const optionalInteger = /* @__PURE__ */ __name((value2, minimum) => value2 == null ? null : Number(value2), "optionalInteger");
  const width = optionalInteger(body.width, 1);
  const height = optionalInteger(body.height, 1);
  const durationMs = optionalInteger(body.durationMs, 0);
  if (width != null && (!Number.isSafeInteger(width) || width < 1) || height != null && (!Number.isSafeInteger(height) || height < 1)) {
    return { ok: false, error: "invalid_dimensions" };
  }
  if (durationMs != null && (!Number.isSafeInteger(durationMs) || durationMs < 0)) {
    return { ok: false, error: "invalid_duration" };
  }
  if (kind === "image" && durationMs != null) return { ok: false, error: "image_duration_not_allowed" };
  return { ok: true, fileName, mediaType, kind, byteSize, sha256: checksum, width, height, durationMs };
}
__name(validateMetadata, "validateMetadata");
async function storedIdempotency2(env, project, action, key, requestHash) {
  const row = await env.TOYS_DB.prepare(
    `SELECT request_hash AS requestHash, response_json AS responseJson
       FROM api_idempotency_keys
      WHERE organization_id = ? AND project_id = ? AND action = ? AND idempotency_key = ?`
  ).bind(project.organizationId, project.id, action, key).first();
  if (!row) return null;
  return row.requestHash === requestHash ? { conflict: false, response: JSON.parse(row.responseJson) } : { conflict: true, response: null };
}
__name(storedIdempotency2, "storedIdempotency");
function idempotencyKey(request, body) {
  const key = String(request.headers.get("x-idempotency-key") || body?.idempotencyKey || "");
  return key.length >= 8 && key.length <= 200 ? key : null;
}
__name(idempotencyKey, "idempotencyKey");
async function findCreative(env, project, creativeId) {
  return env.TOYS_DB.prepare(
    `SELECT id, organization_id AS organizationId, project_id AS projectId,
            kind, file_name AS fileName, media_type AS mediaType, byte_size AS byteSize,
            sha256, width, height, duration_ms AS durationMs, storage_provider AS storageProvider,
            storage_key AS storageKey, upload_state AS uploadState, status,
            status_version AS statusVersion, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
       FROM creative_assets
      WHERE organization_id = ? AND project_id = ? AND id = ?`
  ).bind(project.organizationId, project.id, creativeId).first();
}
__name(findCreative, "findCreative");
async function createCreativeAsset(request, env, auth, project) {
  const context = scopedContext(auth, project, null, "editor");
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const body = await parseBody2(request);
  const metadata = validateMetadata(body);
  if (!metadata.ok) return response2({ ok: false, error: metadata.error }, 400);
  const key = idempotencyKey(request, body);
  if (!key) return response2({ ok: false, error: "idempotency_key_required" }, 400);
  const action = "creative-asset-create";
  const requestHash = await sha256Text2(JSON.stringify(metadata));
  const stored = await storedIdempotency2(env, project, action, key, requestHash);
  if (stored?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response2(stored.response, 201);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const bucket = objectStorage(env);
  const id = crypto.randomUUID();
  const creative2 = {
    id,
    ...metadata,
    uploadState: bucket ? "pending" : "storage_unavailable",
    status: "draft",
    statusVersion: 1,
    createdBy: context.subject,
    createdAt: now,
    updatedAt: now
  };
  delete creative2.ok;
  const resultBody = {
    ok: true,
    creative: creativeModel(creative2),
    upload: bucket ? { available: true, method: "PUT", path: `/creatives/${id}/upload` } : { available: false, reason: "object_storage_binding_missing" }
  };
  const statements = [
    env.TOYS_DB.prepare(
      `INSERT INTO creative_assets
        (id, organization_id, project_id, kind, file_name, media_type, byte_size, sha256,
         width, height, duration_ms, storage_provider, storage_key, upload_state, status,
         status_version, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)`
    ).bind(
      creative2.id,
      project.organizationId,
      project.id,
      creative2.kind,
      creative2.fileName,
      creative2.mediaType,
      creative2.byteSize,
      creative2.sha256,
      creative2.width,
      creative2.height,
      creative2.durationMs,
      bucket ? "r2" : "none",
      bucket ? storageKey(project, creative2.id) : null,
      creative2.uploadState,
      creative2.createdBy,
      creative2.createdAt,
      creative2.updatedAt
    ),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys
        (organization_id, project_id, action, idempotency_key, request_hash, response_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(project.organizationId, project.id, action, key, requestHash, JSON.stringify(resultBody))
  ];
  try {
    const results = await env.TOYS_DB.batch(statements);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1) {
      throw new Error("creative_create_failed");
    }
  } catch (_) {
    const raced = await storedIdempotency2(env, project, action, key, requestHash);
    if (raced?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
    if (raced) return response2(raced.response, 201);
    return response2({ ok: false, error: "creative_create_failed" }, 500);
  }
  return response2(resultBody, 201);
}
__name(createCreativeAsset, "createCreativeAsset");
async function listCreativeAssets(request, env, auth, project) {
  const context = scopedContext(auth, project);
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const kind = url.searchParams.get("kind");
  const limit = Number(url.searchParams.get("limit") || 100);
  if (status && !TRANSITIONS.has(status)) return response2({ ok: false, error: "invalid_status" }, 400);
  if (kind && !["image", "video"].includes(kind)) return response2({ ok: false, error: "invalid_kind" }, 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return response2({ ok: false, error: "invalid_limit" }, 400);
  const rows = await env.TOYS_DB.prepare(
    `SELECT id, kind, file_name AS fileName, media_type AS mediaType, byte_size AS byteSize,
            sha256, width, height, duration_ms AS durationMs, upload_state AS uploadState,
            status, status_version AS statusVersion, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
       FROM creative_assets
      WHERE organization_id = ? AND project_id = ?
        AND (? IS NULL OR status = ?) AND (? IS NULL OR kind = ?)
      ORDER BY created_at DESC, id DESC LIMIT ?`
  ).bind(project.organizationId, project.id, status, status, kind, kind, limit).all();
  return response2({ ok: true, creatives: (rows.results || []).map(creativeModel) });
}
__name(listCreativeAssets, "listCreativeAssets");
async function getCreativePreview(request, env, auth, project, creativeId) {
  const context = scopedContext(auth, project);
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const creative2 = await findCreative(env, project, creativeId);
  if (!creative2) return response2({ ok: false, error: "creative_not_found" }, 404);
  if (creative2.uploadState !== "ready" || !creative2.storageKey) {
    return response2({
      ok: false,
      error: "preview_not_available",
      creativeId: creative2.id,
      reason: "object_storage_binding_missing"
    }, 409);
  }
  const bucket = objectStorage(env);
  if (!bucket) return response2({ ok: false, error: "object_storage_unavailable" }, 503);
  const guard = createCreativeStorageQuotaGuard({ db: env.TOYS_DB });
  try {
    await guard.authorizeOperation({
      project,
      operationClass: "class_b",
      operation: "get",
      creativeAssetId: creative2.id,
      operationId: crypto.randomUUID()
    });
  } catch (error) {
    return storageFailure(error);
  }
  let object;
  try {
    object = await bucket.get(creative2.storageKey);
  } catch (_) {
    return response2({ ok: false, error: "object_storage_read_failed" }, 502);
  }
  if (!object?.body) return response2({ ok: false, error: "creative_object_missing" }, 409);
  const safeName = creative2.fileName.replace(/["\\\r\n]/g, "_");
  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": creative2.mediaType,
      "content-length": String(object.size ?? creative2.byteSize),
      "content-disposition": `inline; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      ...object.etag ? { etag: object.etag } : {}
    }
  });
}
__name(getCreativePreview, "getCreativePreview");
async function uploadCreativeAsset(request, env, auth, project, creativeId) {
  const context = scopedContext(auth, project, null, "editor");
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const creative2 = await findCreative(env, project, creativeId);
  if (!creative2) return response2({ ok: false, error: "creative_not_found" }, 404);
  if (creative2.uploadState === "ready") return response2({ ok: true, creative: creativeModel(creative2), idempotent: true });
  const bucket = objectStorage(env);
  if (!bucket) {
    return response2({ ok: false, error: "object_storage_unavailable", creativeId: creative2.id, reason: "no_writable_r2_binding" }, 503);
  }
  if (creative2.storageProvider !== "r2" || !creative2.storageKey || creative2.uploadState !== "pending") {
    return response2({ ok: false, error: "creative_upload_state_invalid" }, 409);
  }
  const contentType = String(request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== creative2.mediaType) return response2({ ok: false, error: "media_type_mismatch" }, 400);
  const declaredLength = request.headers.get("content-length");
  if (declaredLength != null && Number(declaredLength) !== Number(creative2.byteSize)) {
    return response2({ ok: false, error: "byte_size_mismatch" }, 400);
  }
  const guard = createCreativeStorageQuotaGuard({ db: env.TOYS_DB });
  let reservation;
  try {
    reservation = await guard.reserve({ project, creativeAssetId: creative2.id, bytes: Number(creative2.byteSize) });
  } catch (error) {
    return storageFailure(error);
  }
  const rejectUpload = /* @__PURE__ */ __name(async (body, status) => {
    await guard.release({ project, reservationId: reservation.id });
    return response2(body, status);
  }, "rejectUpload");
  let bytes;
  try {
    bytes = await request.arrayBuffer();
  } catch (_) {
    return rejectUpload({ ok: false, error: "upload_body_unreadable" }, 400);
  }
  if (bytes.byteLength !== Number(creative2.byteSize)) return rejectUpload({ ok: false, error: "byte_size_mismatch" }, 400);
  if (!matchesMagic(creative2.mediaType, new Uint8Array(bytes.slice(0, 16)))) {
    return rejectUpload({ ok: false, error: "media_signature_mismatch" }, 400);
  }
  if (await sha256Bytes(bytes) !== creative2.sha256) return rejectUpload({ ok: false, error: "sha256_mismatch" }, 400);
  try {
    await guard.authorizeOperation({
      project,
      operationClass: "class_a",
      operation: "put",
      creativeAssetId: creative2.id,
      operationId: crypto.randomUUID()
    });
  } catch (error) {
    await guard.release({ project, reservationId: reservation.id });
    return storageFailure(error);
  }
  let stored;
  try {
    stored = await bucket.put(creative2.storageKey, bytes, {
      httpMetadata: { contentType: creative2.mediaType },
      customMetadata: { sha256: creative2.sha256, creativeAssetId: creative2.id }
    });
  } catch (_) {
    await guard.release({ project, reservationId: reservation.id });
    return response2({ ok: false, error: "object_storage_write_failed" }, 502);
  }
  try {
    await guard.commit({
      project,
      reservationId: reservation.id,
      creativeAssetId: creative2.id,
      objectKey: creative2.storageKey,
      actualBytes: Number(stored?.size ?? bytes.byteLength),
      etag: stored?.etag || null
    });
  } catch (error) {
    return storageFailure(error);
  }
  const readback2 = await findCreative(env, project, creative2.id);
  return response2({ ok: true, creative: creativeModel(readback2) }, 201);
}
__name(uploadCreativeAsset, "uploadCreativeAsset");
async function updateCreativeStatus(request, env, auth, project, creativeId) {
  const context = scopedContext(auth, project, null, "editor");
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const body = await parseBody2(request);
  if (!body) return response2({ ok: false, error: "invalid_json" }, 400);
  const key = idempotencyKey(request, body);
  if (!key) return response2({ ok: false, error: "idempotency_key_required" }, 400);
  const toStatus = String(body.status || "");
  const expectedStatus = String(body.expectedStatus || "");
  const reason = body.reason == null ? null : String(body.reason).trim();
  if (!TRANSITIONS.has(toStatus) || !TRANSITIONS.has(expectedStatus)) {
    return response2({ ok: false, error: "invalid_status" }, 400);
  }
  if (body.reason != null && (!reason || reason.length > 1e3)) {
    return response2({ ok: false, error: "invalid_reason" }, 400);
  }
  const action = `creative-status:${creativeId}`;
  const requestHash = await sha256Text2(JSON.stringify({ creativeId, expectedStatus, toStatus, reason }));
  const stored = await storedIdempotency2(env, project, action, key, requestHash);
  if (stored?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response2(stored.response);
  const creative2 = await findCreative(env, project, creativeId);
  if (!creative2) return response2({ ok: false, error: "creative_not_found" }, 404);
  if (creative2.status !== expectedStatus) {
    return response2({ ok: false, error: "creative_status_changed", currentStatus: creative2.status }, 409);
  }
  if (!TRANSITIONS.get(expectedStatus).has(toStatus)) {
    return response2({ ok: false, error: "invalid_status_transition" }, 409);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const nextVersion = Number(creative2.statusVersion) + 1;
  const updated = { ...creative2, status: toStatus, statusVersion: nextVersion, updatedAt: now };
  const event = {
    id: crypto.randomUUID(),
    creativeAssetId: creative2.id,
    fromStatus: expectedStatus,
    toStatus,
    statusVersion: nextVersion,
    actorRef: context.subject,
    reason,
    createdAt: now
  };
  const resultBody = { ok: true, creative: creativeModel(updated), event };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE creative_assets SET status = ?, status_version = ?, updated_at = ?
        WHERE organization_id = ? AND project_id = ? AND id = ? AND status = ? AND status_version = ?`
    ).bind(toStatus, nextVersion, now, project.organizationId, project.id, creative2.id, expectedStatus, creative2.statusVersion),
    env.TOYS_DB.prepare(
      `INSERT INTO creative_status_events
        (id, organization_id, project_id, creative_asset_id, from_status, to_status,
         status_version, actor_ref, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.id,
      project.organizationId,
      project.id,
      creative2.id,
      expectedStatus,
      toStatus,
      nextVersion,
      event.actorRef,
      reason,
      now
    ),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys
        (organization_id, project_id, action, idempotency_key, request_hash, response_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(project.organizationId, project.id, action, key, requestHash, JSON.stringify(resultBody))
  ];
  try {
    const results = await env.TOYS_DB.batch(statements);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1) throw new Error("creative_status_changed");
  } catch (_) {
    const raced = await storedIdempotency2(env, project, action, key, requestHash);
    if (raced?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
    if (raced) return response2(raced.response);
    const latest = await findCreative(env, project, creativeId);
    return response2({ ok: false, error: "creative_status_changed", currentStatus: latest?.status || null }, 409);
  }
  return response2(resultBody);
}
__name(updateCreativeStatus, "updateCreativeStatus");
async function createCreativeComment(request, env, auth, project, creativeId) {
  const context = scopedContext(auth, project);
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const body = await parseBody2(request);
  if (!body) return response2({ ok: false, error: "invalid_json" }, 400);
  const value2 = typeof body.body === "string" ? body.body.trim() : "";
  if (!value2) return response2({ ok: false, error: "comment_body_required" }, 400);
  if (value2.length > 3e3) return response2({ ok: false, error: "comment_body_too_large" }, 400);
  const key = idempotencyKey(request, body);
  if (!key) return response2({ ok: false, error: "idempotency_key_required" }, 400);
  const creative2 = await findCreative(env, project, creativeId);
  if (!creative2) return response2({ ok: false, error: "creative_not_found" }, 404);
  const action = `creative-comment:${creativeId}`;
  const requestHash = await sha256Text2(JSON.stringify({ creativeId, body: value2 }));
  const stored = await storedIdempotency2(env, project, action, key, requestHash);
  if (stored?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response2(stored.response, 201);
  const comment = {
    id: crypto.randomUUID(),
    creativeAssetId: creative2.id,
    authorRef: context.subject,
    body: value2,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const resultBody = { ok: true, comment };
  try {
    const results = await env.TOYS_DB.batch([
      env.TOYS_DB.prepare(
        `INSERT INTO creative_comments
          (id, organization_id, project_id, creative_asset_id, author_ref, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(comment.id, project.organizationId, project.id, creative2.id, comment.authorRef, comment.body, comment.createdAt),
      env.TOYS_DB.prepare(
        `INSERT INTO api_idempotency_keys
          (organization_id, project_id, action, idempotency_key, request_hash, response_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(project.organizationId, project.id, action, key, requestHash, JSON.stringify(resultBody))
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1) throw new Error("comment_create_failed");
  } catch (_) {
    const raced = await storedIdempotency2(env, project, action, key, requestHash);
    if (raced?.conflict) return response2({ ok: false, error: "idempotency_key_reuse" }, 409);
    if (raced) return response2(raced.response, 201);
    return response2({ ok: false, error: "comment_create_failed" }, 500);
  }
  return response2(resultBody, 201);
}
__name(createCreativeComment, "createCreativeComment");
async function listCreativeComments(request, env, auth, project, creativeId) {
  const context = scopedContext(auth, project);
  if (!context.ok) return response2({ ok: false, error: context.error }, context.status);
  const creative2 = await findCreative(env, project, creativeId);
  if (!creative2) return response2({ ok: false, error: "creative_not_found" }, 404);
  const url = new URL(request.url);
  const order = String(url.searchParams.get("order") || "newest");
  const chronological = order === "chronological" || order === "oldest";
  const limit = Number(url.searchParams.get("limit") || 100);
  if (!chronological && order !== "newest") return response2({ ok: false, error: "invalid_order" }, 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return response2({ ok: false, error: "invalid_limit" }, 400);
  const direction = chronological ? "ASC" : "DESC";
  const rows = await env.TOYS_DB.prepare(
    `SELECT id, creative_asset_id AS creativeAssetId, author_ref AS authorRef,
            body, created_at AS createdAt
       FROM creative_comments
      WHERE organization_id = ? AND project_id = ? AND creative_asset_id = ?
      ORDER BY created_at ${direction}, id ${direction} LIMIT ?`
  ).bind(project.organizationId, project.id, creative2.id, limit).all();
  return response2({
    ok: true,
    creativeAssetId: creative2.id,
    order: chronological ? "chronological" : "newest",
    comments: (rows.results || []).map(commentModel2)
  });
}
__name(listCreativeComments, "listCreativeComments");

// src/on-demand-ads.js
var METRIC_NAMES = Object.freeze(["impressions", "clicks", "spend", "conversions", "conversionValue"]);
var METRIC_UNITS = Object.freeze({
  impressions: "count",
  clicks: "count",
  spend: "currency",
  conversions: "count",
  conversionValue: "currency"
});
var ADS_ON_DEMAND_SCHEMA_VERSION = "toys-ads-hierarchy/1";
var ADS_ON_DEMAND_MAX_CACHE_MINUTES = 60;
var OnDemandAdsError = class extends Error {
  static {
    __name(this, "OnDemandAdsError");
  }
  constructor(code, message2 = code, details = null) {
    super(message2);
    this.name = "OnDemandAdsError";
    this.code = code;
    this.details = details;
  }
};
function fail2(code, message2, details = null) {
  throw new OnDemandAdsError(code, message2, details);
}
__name(fail2, "fail");
function text(value2) {
  return String(value2 ?? "").trim();
}
__name(text, "text");
function isoDate(value2, field) {
  const candidate = text(value2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) fail2("invalid_date", `${field} must be YYYY-MM-DD`);
  const parsed = /* @__PURE__ */ new Date(`${candidate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    fail2("invalid_date", `${field} is not a calendar date`);
  }
  return candidate;
}
__name(isoDate, "isoDate");
function instant(value2, field) {
  const parsed = value2 instanceof Date ? value2 : new Date(value2);
  if (Number.isNaN(parsed.getTime())) fail2("invalid_clock", `${field} is not a valid instant`);
  return parsed;
}
__name(instant, "instant");
function safeJson(value2, fallback = {}) {
  if (value2 == null || value2 === "") return fallback;
  try {
    const parsed = typeof value2 === "string" ? JSON.parse(value2) : value2;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}
__name(safeJson, "safeJson");
function safeCode(error) {
  const candidate = text(error?.code).toLowerCase();
  return /^[a-z][a-z0-9_]{0,63}$/.test(candidate) ? candidate : "provider_refresh_failed";
}
__name(safeCode, "safeCode");
function normalizeAccountId(value2) {
  return text(value2).replace(/^act_/i, "").replace(/-/g, "");
}
__name(normalizeAccountId, "normalizeAccountId");
function timezone(value2, field) {
  const candidate = text(value2);
  if (!candidate) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(/* @__PURE__ */ new Date(0));
  } catch (_) {
    fail2("invalid_integration_config", `${field} must be an IANA timezone`);
  }
  return candidate;
}
__name(timezone, "timezone");
function currency(value2, field) {
  const candidate = text(value2).toUpperCase();
  if (candidate && !/^[A-Z]{3}$/.test(candidate)) fail2("invalid_provider_result", `${field} must be an ISO currency code`);
  return candidate || null;
}
__name(currency, "currency");
function decimal(value2, field) {
  const candidate = typeof value2 === "number" ? String(value2) : text(value2);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(candidate)) {
    fail2("invalid_provider_result", `${field} must be a non-negative decimal`);
  }
  const [whole, rawFraction = ""] = candidate.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  return `${whole.replace(/^0+(?=\d)/, "") || "0"}${fraction ? `.${fraction}` : ""}`;
}
__name(decimal, "decimal");
function normalizeMetric(value2, name, { unsupported, resultCurrency, field }) {
  if (value2 && typeof value2 === "object" && !Array.isArray(value2) && "state" in value2) {
    const state = text(value2.state);
    if (!["observed", "missing", "unsupported"].includes(state)) {
      fail2("invalid_provider_result", `${field}.${name}.state is invalid`);
    }
    if (state !== "observed") {
      if (value2.value != null) fail2("invalid_provider_result", `${field}.${name} must not carry a value when ${state}`);
      return { value: null, state, unit: METRIC_UNITS[name], currency: METRIC_UNITS[name] === "currency" ? resultCurrency : null };
    }
    value2 = value2.value;
  }
  if (value2 == null || value2 === "") {
    return {
      value: null,
      state: unsupported.has(name) ? "unsupported" : "missing",
      unit: METRIC_UNITS[name],
      currency: METRIC_UNITS[name] === "currency" ? resultCurrency : null
    };
  }
  return {
    value: decimal(value2, `${field}.${name}`),
    state: "observed",
    unit: METRIC_UNITS[name],
    currency: METRIC_UNITS[name] === "currency" ? resultCurrency : null
  };
}
__name(normalizeMetric, "normalizeMetric");
function normalizeDailyMetrics(rows, context) {
  if (rows == null) rows = [];
  if (!Array.isArray(rows)) fail2("invalid_provider_result", `${context.field}.dailyMetrics must be an array`);
  const seen = /* @__PURE__ */ new Set();
  return rows.map((row, index) => {
    const field = `${context.field}.dailyMetrics[${index}]`;
    const date2 = isoDate(row?.date, `${field}.date`);
    if (date2 < context.from || date2 > context.to) fail2("provider_date_scope_mismatch", `${field}.date is outside the request`);
    if (seen.has(date2)) fail2("invalid_provider_result", `${context.field} has duplicate daily metrics for ${date2}`);
    seen.add(date2);
    const raw = row?.metrics && typeof row.metrics === "object" ? row.metrics : row;
    const metrics = Object.fromEntries(context.metrics.map((name) => [
      name,
      normalizeMetric(raw?.[name], name, { ...context, field })
    ]));
    return { date: date2, metrics };
  }).sort((left, right) => left.date.localeCompare(right.date));
}
__name(normalizeDailyMetrics, "normalizeDailyMetrics");
function entityId(value2, field) {
  const id = text(value2);
  if (!id || id.length > 256) fail2("invalid_provider_result", `${field} is required and must be at most 256 characters`);
  return id;
}
__name(entityId, "entityId");
function normalizeEntity(raw, { level, providerLevel, parentProviderId = null, ...context }, seen) {
  const providerId2 = entityId(raw?.id ?? raw?.providerId, `${context.field}.id`);
  const identity = `${level}:${providerId2}`;
  if (seen.has(identity)) fail2("invalid_provider_result", `duplicate ${level} id ${providerId2}`);
  seen.add(identity);
  if (raw?.parentId != null && text(raw.parentId) !== parentProviderId) {
    fail2("provider_hierarchy_mismatch", `${context.field}.parentId does not match its parent`);
  }
  const output = {
    level,
    providerLevel,
    providerId: providerId2,
    parentProviderId,
    name: text(raw?.name) || null,
    status: text(raw?.status) || null,
    dailyMetrics: normalizeDailyMetrics(raw?.dailyMetrics, context),
    children: []
  };
  if (level === "ad") output.creativeRef = text(raw?.creativeRef) || null;
  return output;
}
__name(normalizeEntity, "normalizeEntity");
function normalizeCampaigns(result, context) {
  const campaigns = result?.campaigns ?? [];
  if (!Array.isArray(campaigns)) fail2("invalid_provider_result", "campaigns must be an array");
  const seen = /* @__PURE__ */ new Set();
  return campaigns.map((campaign, campaignIndex) => {
    const campaignContext = { ...context, field: `campaigns[${campaignIndex}]` };
    const normalizedCampaign = normalizeEntity(campaign, {
      ...campaignContext,
      level: "campaign",
      providerLevel: "campaign"
    }, seen);
    const groupRows = campaign.groups ?? (context.provider === "meta_ads" ? campaign.adsets : campaign.adGroups) ?? [];
    if (!Array.isArray(groupRows)) fail2("invalid_provider_result", `${campaignContext.field}.groups must be an array`);
    normalizedCampaign.children = groupRows.map((group, groupIndex) => {
      const groupContext = { ...context, field: `${campaignContext.field}.groups[${groupIndex}]` };
      const normalizedGroup = normalizeEntity(group, {
        ...groupContext,
        level: "group",
        providerLevel: context.provider === "meta_ads" ? "adset" : "ad_group",
        parentProviderId: normalizedCampaign.providerId
      }, seen);
      const ads = group.ads ?? [];
      if (!Array.isArray(ads)) fail2("invalid_provider_result", `${groupContext.field}.ads must be an array`);
      normalizedGroup.children = ads.map((ad, adIndex) => normalizeEntity(ad, {
        ...context,
        field: `${groupContext.field}.ads[${adIndex}]`,
        level: "ad",
        providerLevel: "ad",
        parentProviderId: normalizedGroup.providerId
      }, seen));
      return normalizedGroup;
    });
    return normalizedCampaign;
  });
}
__name(normalizeCampaigns, "normalizeCampaigns");
function normalizeMissingRanges(ranges, from, to) {
  if (ranges == null) return [];
  if (!Array.isArray(ranges)) fail2("invalid_provider_result", "missingRanges must be an array");
  return ranges.map((range, index) => {
    const missingFrom = isoDate(range?.from, `missingRanges[${index}].from`);
    const missingTo = isoDate(range?.to, `missingRanges[${index}].to`);
    if (missingFrom > missingTo || missingFrom < from || missingTo > to) {
      fail2("provider_date_scope_mismatch", `missingRanges[${index}] is outside the request`);
    }
    return { from: missingFrom, to: missingTo };
  });
}
__name(normalizeMissingRanges, "normalizeMissingRanges");
function hierarchyDates(children) {
  const dates = [];
  const visit = /* @__PURE__ */ __name((node) => {
    for (const row of node.dailyMetrics || []) dates.push(row.date);
    for (const child of node.children || []) visit(child);
  }, "visit");
  for (const child of children) visit(child);
  return dates.sort();
}
__name(hierarchyDates, "hierarchyDates");
function normalizeAdsHierarchy(result, scope) {
  if (!result || typeof result !== "object") fail2("invalid_provider_result", "provider result must be an object");
  if (result.partial === true || result.coverage && result.coverage !== "complete") {
    fail2("partial_provider_result", "an incomplete provider result cannot replace last-good data");
  }
  if (result.provider && result.provider !== scope.provider) fail2("provider_scope_mismatch", "provider result is out of scope");
  if (result.accountId && normalizeAccountId(result.accountId) !== normalizeAccountId(scope.accountId)) {
    fail2("account_scope_mismatch", "provider result account is out of scope");
  }
  if (result.timezone && result.timezone !== scope.timezone) fail2("timezone_scope_mismatch", "provider result timezone is out of scope");
  const resultCurrency = currency(result.currency ?? scope.currency, "currency");
  if (scope.currency && resultCurrency && resultCurrency !== scope.currency) {
    fail2("currency_scope_mismatch", "provider result currency is out of scope");
  }
  const unsupported = new Set((result.unsupportedMetrics || []).map(text));
  for (const metric3 of unsupported) if (!METRIC_NAMES.includes(metric3)) fail2("invalid_provider_result", `unknown unsupported metric ${metric3}`);
  const context = {
    provider: scope.provider,
    from: scope.from,
    to: scope.to,
    metrics: scope.metrics,
    unsupported,
    resultCurrency
  };
  const children = normalizeCampaigns(result, context);
  const dates = hierarchyDates(children);
  const observedRange = dates.length ? { from: dates[0], to: dates.at(-1) } : null;
  return {
    schemaVersion: ADS_ON_DEMAND_SCHEMA_VERSION,
    provider: scope.provider,
    integrationId: scope.integrationId,
    requestedRange: { from: scope.from, to: scope.to },
    observedRange,
    dataThroughDate: result.dataThroughDate ? isoDate(result.dataThroughDate, "dataThroughDate") : observedRange?.to || null,
    missingRanges: normalizeMissingRanges(result.missingRanges, scope.from, scope.to),
    coverage: "complete",
    metricAvailability: Object.fromEntries(scope.metrics.map((name) => [name, unsupported.has(name) ? "unsupported" : "supported"])),
    levelsAreAlternative: true,
    hierarchy: {
      level: "account",
      providerLevel: "account",
      providerId: scope.accountId,
      parentProviderId: null,
      name: text(result.accountName) || null,
      status: text(result.accountStatus) || null,
      timezone: scope.timezone,
      currency: resultCurrency,
      dailyMetrics: normalizeDailyMetrics(result.dailyMetrics, { ...context, field: "account" }),
      children
    }
  };
}
__name(normalizeAdsHierarchy, "normalizeAdsHierarchy");
async function first2(db, sql, args = []) {
  return db.prepare(sql).bind(...args).first();
}
__name(first2, "first");
async function all(db, sql, args = []) {
  const result = await db.prepare(sql).bind(...args).all();
  return result?.results || [];
}
__name(all, "all");
async function run2(db, sql, args = []) {
  return db.prepare(sql).bind(...args).run();
}
__name(run2, "run");
function adapterFunction(adapter) {
  if (typeof adapter === "function") return adapter;
  if (typeof adapter?.fetchHierarchy === "function") return adapter.fetchHierarchy.bind(adapter);
  return null;
}
__name(adapterFunction, "adapterFunction");
function integrationScope(project, integration, metrics) {
  const config = safeJson(integration.configJson);
  const accountId2 = normalizeAccountId(integration.externalAccountId);
  const accountTimezone = timezone(
    config.accountTimezone ?? config.timezone ?? config.sourceTimezone ?? project.timezone,
    `${integration.id}.timezone`
  );
  const expectedCurrency = currency(config.expectedCurrency ?? config.currency ?? project.currency, `${integration.id}.currency`);
  return {
    organizationId: project.organizationId,
    projectId: project.id,
    projectSlug: project.slug,
    integrationId: integration.id,
    provider: integration.provider,
    accountId: accountId2,
    timezone: accountTimezone,
    currency: expectedCurrency,
    config,
    metrics,
    mappingRevision: text(config.conversionMappingRevision ?? config.mappingVersion) || "unconfigured",
    providerApiVersion: text(config.apiVersion) || "adapter_default"
  };
}
__name(integrationScope, "integrationScope");
function cacheKey(scope, from, to) {
  return [
    "ads-on-demand-v1",
    scope.organizationId,
    scope.projectId,
    scope.integrationId,
    scope.provider,
    scope.accountId,
    scope.timezone,
    from,
    to,
    "ad",
    scope.metrics.join(","),
    scope.mappingRevision,
    scope.providerApiVersion,
    ADS_ON_DEMAND_SCHEMA_VERSION
  ].map((value2) => encodeURIComponent(value2)).join(":");
}
__name(cacheKey, "cacheKey");
async function ensureCacheRow(db, scope, from, to, key) {
  await run2(db, `INSERT INTO ads_on_demand_cache
    (cache_key,organization_id,project_id,integration_id,provider,account_scope,account_timezone,
     range_from,range_to,level,metrics_json,mapping_revision,provider_api_version,schema_version)
    VALUES (?,?,?,?,?,?,?,?,?,'ad',?,?,?,?)
    ON CONFLICT(cache_key) DO NOTHING`, [
    key,
    scope.organizationId,
    scope.projectId,
    scope.integrationId,
    scope.provider,
    scope.accountId,
    scope.timezone,
    from,
    to,
    JSON.stringify(scope.metrics),
    scope.mappingRevision,
    scope.providerApiVersion,
    ADS_ON_DEMAND_SCHEMA_VERSION
  ]);
}
__name(ensureCacheRow, "ensureCacheRow");
async function readCache(db, key) {
  return first2(db, `SELECT last_good_payload_json AS payloadJson,last_good_at AS lastGoodAt,
      expires_at AS expiresAt,last_attempt_at AS lastAttemptAt,
      last_attempt_status AS lastAttemptStatus,last_error_code AS lastErrorCode
    FROM ads_on_demand_cache WHERE cache_key=?`, [key]);
}
__name(readCache, "readCache");
function cachedPayload(row) {
  if (!row?.payloadJson || !row?.lastGoodAt || !row?.expiresAt) return null;
  try {
    const payload = JSON.parse(row.payloadJson);
    return payload && typeof payload === "object" ? payload : null;
  } catch (_) {
    return null;
  }
}
__name(cachedPayload, "cachedPayload");
function decorated(payload, { source, freshness, refreshState, errorCode = null, row = null }) {
  return {
    ...payload,
    source,
    freshness,
    fetchedAt: payload.fetchedAt || row?.lastGoodAt || null,
    expiresAt: payload.expiresAt || row?.expiresAt || null,
    lastGoodAt: row?.lastGoodAt || payload.fetchedAt || null,
    refresh: {
      state: refreshState,
      lastAttemptAt: row?.lastAttemptAt || null,
      errorCode
    }
  };
}
__name(decorated, "decorated");
function unavailable(scope, state, code, row = null) {
  return {
    schemaVersion: ADS_ON_DEMAND_SCHEMA_VERSION,
    provider: scope.provider,
    integrationId: scope.integrationId,
    requestedRange: scope.from && scope.to ? { from: scope.from, to: scope.to } : null,
    source: "none",
    freshness: state === "refreshing" ? "refreshing" : "unavailable",
    availability: state,
    fetchedAt: null,
    expiresAt: null,
    lastGoodAt: null,
    errorCode: code,
    refresh: { state, lastAttemptAt: row?.lastAttemptAt || null, errorCode: code },
    hierarchy: null
  };
}
__name(unavailable, "unavailable");
async function markAttempt(db, key, at, status, errorCode = null) {
  await run2(
    db,
    `UPDATE ads_on_demand_cache
    SET last_attempt_at=?,last_attempt_status=?,last_error_code=?,updated_at=? WHERE cache_key=?`,
    [at, status, errorCode, at, key]
  );
}
__name(markAttempt, "markAttempt");
async function acquireGuard(db, scope, key, token, now, leaseMs, cooldownMs) {
  const expires = new Date(now.getTime() + leaseMs).toISOString();
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();
  const at = now.toISOString();
  await run2(
    db,
    `INSERT INTO ads_on_demand_refresh_guards
      (integration_id,active_cache_key,owner_token,last_started_at,lease_expires_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(integration_id) DO UPDATE SET
      active_cache_key=excluded.active_cache_key,
      owner_token=excluded.owner_token,
      last_started_at=excluded.last_started_at,
      lease_expires_at=excluded.lease_expires_at
    WHERE (ads_on_demand_refresh_guards.owner_token IS NULL
           OR ads_on_demand_refresh_guards.lease_expires_at <= excluded.last_started_at)
      AND (ads_on_demand_refresh_guards.last_started_at IS NULL
           OR ads_on_demand_refresh_guards.last_started_at <= ?)`,
    [scope.integrationId, key, token, at, expires, cutoff]
  );
  const guard = await first2(db, `SELECT owner_token AS ownerToken,last_started_at AS lastStartedAt,
      lease_expires_at AS leaseExpiresAt,active_cache_key AS activeCacheKey
    FROM ads_on_demand_refresh_guards WHERE integration_id=?`, [scope.integrationId]);
  return { acquired: guard?.ownerToken === token, guard };
}
__name(acquireGuard, "acquireGuard");
async function releaseGuard(db, integrationId, token) {
  await run2(db, `UPDATE ads_on_demand_refresh_guards
    SET active_cache_key=NULL,owner_token=NULL,lease_expires_at=NULL
    WHERE integration_id=? AND owner_token=?`, [integrationId, token]);
}
__name(releaseGuard, "releaseGuard");
function fallbackOrUnavailable(scope, row, { state, code }) {
  const payload = cachedPayload(row);
  if (payload) return decorated(payload, {
    source: "cache",
    freshness: state === "refreshing" ? "refreshing" : "stale",
    refreshState: state,
    errorCode: code,
    row
  });
  return unavailable(scope, state, code, row);
}
__name(fallbackOrUnavailable, "fallbackOrUnavailable");
function randomToken(randomId) {
  const value2 = text(randomId());
  if (!value2) fail2("invalid_random_id", "randomId returned an empty token");
  return value2;
}
__name(randomToken, "randomToken");
function responseFreshness(results) {
  if (!results.length) return "unavailable";
  const values = new Set(results.map((item) => item.freshness));
  if (values.size === 1) return [...values][0];
  if ([...values].every((value2) => ["stale", "refreshing"].includes(value2))) return "stale";
  return "partial";
}
__name(responseFreshness, "responseFreshness");
function responseSource(results) {
  const sources = new Set(results.map((item) => item.source));
  return sources.size === 1 ? [...sources][0] : "mixed";
}
__name(responseSource, "responseSource");
function createOnDemandAdsService({
  db,
  providers = {},
  now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now"),
  randomId = /* @__PURE__ */ __name(() => globalThis.crypto.randomUUID(), "randomId"),
  cacheTtlMinutes = 30,
  refreshCooldownMs = 1e4,
  refreshLeaseMs = 45e3
} = {}) {
  if (!db?.prepare) fail2("db_required", "D1-compatible db is required");
  if (!Number.isFinite(cacheTtlMinutes) || cacheTtlMinutes <= 0 || cacheTtlMinutes > ADS_ON_DEMAND_MAX_CACHE_MINUTES) {
    fail2("invalid_cache_ttl", `cacheTtlMinutes must be > 0 and <= ${ADS_ON_DEMAND_MAX_CACHE_MINUTES}`);
  }
  if (!Number.isFinite(refreshCooldownMs) || refreshCooldownMs < 0) fail2("invalid_refresh_cooldown", "refreshCooldownMs must be non-negative");
  if (!Number.isFinite(refreshLeaseMs) || refreshLeaseMs <= 0) fail2("invalid_refresh_lease", "refreshLeaseMs must be positive");
  const inFlight = /* @__PURE__ */ new Map();
  async function refresh(scope, adapter, key) {
    const started = instant(now(), "now");
    const row = await readCache(db, key);
    const token = randomToken(randomId);
    const { acquired, guard } = await acquireGuard(db, scope, key, token, started, refreshLeaseMs, refreshCooldownMs);
    if (!acquired) {
      const isRunning = guard?.ownerToken && guard.leaseExpiresAt > started.toISOString();
      return fallbackOrUnavailable(scope, row, {
        state: isRunning ? "refreshing" : "rate_limited",
        code: isRunning ? "refresh_in_progress" : "refresh_rate_limited"
      });
    }
    const startedAt = started.toISOString();
    await markAttempt(db, key, startedAt, "running");
    try {
      const providerResult = await adapter({
        project: { id: scope.projectId, slug: scope.projectSlug, organizationId: scope.organizationId },
        integration: {
          id: scope.integrationId,
          provider: scope.provider,
          accountId: scope.accountId,
          timezone: scope.timezone,
          currency: scope.currency,
          config: scope.config
        },
        request: { from: scope.from, to: scope.to, level: "ad", metrics: [...scope.metrics] }
      });
      const normalized = normalizeAdsHierarchy(providerResult, scope);
      const completed = instant(now(), "now");
      const fetchedAt = completed.toISOString();
      const expiresAt = new Date(completed.getTime() + cacheTtlMinutes * 6e4).toISOString();
      const payload = { ...normalized, fetchedAt, expiresAt };
      await run2(db, `UPDATE ads_on_demand_cache SET
          last_good_payload_json=?,last_good_at=?,expires_at=?,last_attempt_at=?,
          last_attempt_status='success',last_error_code=NULL,updated_at=?
        WHERE cache_key=?`, [JSON.stringify(payload), fetchedAt, expiresAt, fetchedAt, fetchedAt, key]);
      return decorated(payload, { source: "live", freshness: "fresh", refreshState: "succeeded" });
    } catch (error) {
      const code = safeCode(error);
      const failedAt = instant(now(), "now").toISOString();
      await markAttempt(db, key, failedAt, "error", code);
      const failedRow = await readCache(db, key);
      return fallbackOrUnavailable(scope, failedRow, { state: "failed", code });
    } finally {
      await releaseGuard(db, scope.integrationId, token);
    }
  }
  __name(refresh, "refresh");
  async function getIntegration(scope, { from, to, forceRefresh }) {
    scope.from = from;
    scope.to = to;
    if (!scope.accountId || !scope.timezone) {
      return unavailable(scope, "missing", !scope.accountId ? "account_scope_missing" : "account_timezone_missing");
    }
    const adapter = adapterFunction(providers[scope.provider]);
    if (!adapter) return unavailable(scope, "unsupported", "provider_adapter_unavailable");
    const key = cacheKey(scope, from, to);
    await ensureCacheRow(db, scope, from, to, key);
    const row = await readCache(db, key);
    const payload = cachedPayload(row);
    const checkedAt = instant(now(), "now");
    if (!forceRefresh && payload && new Date(row.expiresAt).getTime() > checkedAt.getTime()) {
      return decorated(payload, { source: "cache", freshness: "fresh", refreshState: "not_needed", row });
    }
    let promise = inFlight.get(key);
    if (!promise) {
      promise = refresh(scope, adapter, key).finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
    }
    return promise;
  }
  __name(getIntegration, "getIntegration");
  return Object.freeze({
    async getStats({ organizationId, projectSlug, projectId, from, to, metrics = METRIC_NAMES, forceRefresh = false } = {}) {
      const org = text(organizationId);
      if (!org) fail2("organization_required", "organizationId is required");
      const slug2 = text(projectSlug);
      const id = text(projectId);
      if (!slug2 && !id || slug2 && id) fail2("project_identifier_required", "provide exactly one of projectSlug or projectId");
      const start = isoDate(from, "from");
      const end = isoDate(to, "to");
      if (end < start) fail2("invalid_date_range", "to must not precede from");
      const inclusiveDays = (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 864e5 + 1;
      if (inclusiveDays > 90) fail2("invalid_date_range", "Ads date range must not exceed 90 days");
      if (!Array.isArray(metrics) || !metrics.length) fail2("invalid_metrics", "metrics must be a non-empty array");
      const requestedMetrics = [...new Set(metrics.map(text))].sort();
      for (const metric3 of requestedMetrics) if (!METRIC_NAMES.includes(metric3)) fail2("invalid_metrics", `unsupported metric ${metric3}`);
      const project = await first2(db, `SELECT id,organization_id AS organizationId,slug,name,currency,timezone
        FROM projects WHERE organization_id=? AND ${slug2 ? "slug" : "id"}=? AND status='active'`, [org, slug2 || id]);
      if (!project) fail2("active_project_not_found", "active project not found");
      const integrations = await all(db, `SELECT id,provider,external_account_id AS externalAccountId,
          config_json AS configJson,secret_ref AS secretRef
        FROM integrations
        WHERE project_id=? AND status='active' AND provider IN ('meta_ads','google_ads')
        ORDER BY provider,id`, [project.id]);
      const requestId2 = randomToken(randomId);
      if (!integrations.length) {
        return {
          schemaVersion: ADS_ON_DEMAND_SCHEMA_VERSION,
          requestId: requestId2,
          project: { id: project.id, slug: project.slug },
          requestedRange: { from: start, to: end },
          source: "none",
          freshness: "unavailable",
          availability: "missing",
          errorCode: "active_ads_integration_missing",
          providers: []
        };
      }
      const scopes = integrations.map((integration) => integrationScope(project, integration, requestedMetrics));
      const results = await Promise.all(scopes.map((scope) => getIntegration(scope, { from: start, to: end, forceRefresh: Boolean(forceRefresh) })));
      return {
        schemaVersion: ADS_ON_DEMAND_SCHEMA_VERSION,
        requestId: requestId2,
        project: { id: project.id, slug: project.slug },
        requestedRange: { from: start, to: end },
        source: responseSource(results),
        freshness: responseFreshness(results),
        providers: results
      };
    }
  });
}
__name(createOnDemandAdsService, "createOnDemandAdsService");
var ON_DEMAND_ADS_INTERNALS = Object.freeze({ METRIC_NAMES });

// src/meta-ads-hierarchy.js
import { createHmac } from "node:crypto";
var DEFAULT_API_VERSION = "v26.0";
var RETRYABLE_STATUS = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var MetaHierarchyError = class extends Error {
  static {
    __name(this, "MetaHierarchyError");
  }
  constructor(code) {
    super(code);
    this.name = "MetaHierarchyError";
    this.code = code;
  }
};
function fail3(code) {
  throw new MetaHierarchyError(code);
}
__name(fail3, "fail");
function text2(value2) {
  return String(value2 ?? "").trim();
}
__name(text2, "text");
function accountId(value2) {
  const normalized = text2(value2).replace(/^act_/i, "").replace(/-/g, "");
  if (!/^\d+$/.test(normalized)) fail3("invalid_integration_config");
  return normalized;
}
__name(accountId, "accountId");
function decimal2(value2, field) {
  const normalized = text2(value2);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) fail3(`invalid_${field}`);
  const [whole, fraction = ""] = normalized.split(".");
  return { value: BigInt(`${whole}${fraction}`), scale: fraction.length };
}
__name(decimal2, "decimal");
function add(left, right, field) {
  const a = decimal2(left, field);
  const b = decimal2(right, field);
  const scale = Math.max(a.scale, b.scale);
  const total = a.value * 10n ** BigInt(scale - a.scale) + b.value * 10n ** BigInt(scale - b.scale);
  const digits2 = total.toString().padStart(scale + 1, "0");
  const normalized = scale ? `${digits2.slice(0, -scale)}.${digits2.slice(-scale)}` : digits2;
  return normalized.includes(".") ? normalized.replace(/0+$/, "").replace(/\.$/, "") || "0" : normalized;
}
__name(add, "add");
function isoDate2(value2) {
  const normalized = text2(value2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) fail3("provider_schema_mismatch");
  const parsed = /* @__PURE__ */ new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) fail3("provider_schema_mismatch");
  return normalized;
}
__name(isoDate2, "isoDate");
function eachDate(from, to) {
  const output = [];
  const cursor = /* @__PURE__ */ new Date(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}
__name(eachDate, "eachDate");
function missingRanges(from, to, observedDates) {
  const missing = eachDate(from, to).filter((date2) => !observedDates.has(date2));
  const output = [];
  for (const date2 of missing) {
    const previous = output.at(-1);
    const nextTo = previous && /* @__PURE__ */ new Date(`${previous.to}T00:00:00.000Z`);
    if (nextTo) nextTo.setUTCDate(nextTo.getUTCDate() + 1);
    if (previous && nextTo.toISOString().slice(0, 10) === date2) previous.to = date2;
    else output.push({ from: date2, to: date2 });
  }
  return output;
}
__name(missingRanges, "missingRanges");
function metricRow(date2, raw) {
  return {
    date: date2,
    metrics: {
      impressions: text2(raw.impressions) || "0",
      clicks: text2(raw.clicks) || "0",
      spend: text2(raw.spend) || "0"
    }
  };
}
__name(metricRow, "metricRow");
function addDaily(target, row) {
  const existing = target.get(row.date);
  if (!existing) {
    target.set(row.date, structuredClone(row));
    return;
  }
  for (const metric3 of ["impressions", "clicks", "spend"]) {
    existing.metrics[metric3] = add(existing.metrics[metric3], row.metrics[metric3], metric3);
  }
}
__name(addDaily, "addDaily");
function dailyRows(values) {
  return [...values.values()].sort((left, right) => left.date.localeCompare(right.date));
}
__name(dailyRows, "dailyRows");
function entity(id, name, parentId = null) {
  return { id, name: name || null, parentId, status: null, daily: /* @__PURE__ */ new Map(), children: /* @__PURE__ */ new Map() };
}
__name(entity, "entity");
function hierarchy(rows, expectedAccountId) {
  const campaigns = /* @__PURE__ */ new Map();
  const accountDaily = /* @__PURE__ */ new Map();
  const observedDates = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  let accountCurrency = null;
  for (const [index, raw] of rows.entries()) {
    const returnedAccount = accountId(raw?.account_id);
    if (returnedAccount !== expectedAccountId) fail3("account_scope_mismatch");
    const currency3 = text2(raw?.account_currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency3)) fail3("provider_schema_mismatch");
    if (accountCurrency && accountCurrency !== currency3) fail3("currency_scope_mismatch");
    accountCurrency = currency3;
    const date2 = isoDate2(raw?.date_start);
    if (isoDate2(raw?.date_stop) !== date2) fail3("provider_schema_mismatch");
    const campaignId = accountId(raw?.campaign_id);
    const groupId = accountId(raw?.adset_id);
    const adId = accountId(raw?.ad_id);
    const identity = `${date2}:${campaignId}:${groupId}:${adId}`;
    if (seen.has(identity)) fail3("duplicate_provider_row");
    seen.add(identity);
    const metrics = metricRow(date2, raw);
    observedDates.add(date2);
    addDaily(accountDaily, metrics);
    let campaign = campaigns.get(campaignId);
    if (!campaign) {
      campaign = entity(campaignId, text2(raw?.campaign_name));
      campaigns.set(campaignId, campaign);
    }
    if (campaign.name !== (text2(raw?.campaign_name) || null)) fail3("provider_identity_drift");
    addDaily(campaign.daily, metrics);
    let group = campaign.children.get(groupId);
    if (!group) {
      group = entity(groupId, text2(raw?.adset_name), campaignId);
      campaign.children.set(groupId, group);
    }
    if (group.name !== (text2(raw?.adset_name) || null)) fail3("provider_identity_drift");
    addDaily(group.daily, metrics);
    let ad = group.children.get(adId);
    if (!ad) {
      ad = entity(adId, text2(raw?.ad_name), groupId);
      ad.creativeRef = null;
      group.children.set(adId, ad);
    }
    if (ad.name !== (text2(raw?.ad_name) || null)) fail3("provider_identity_drift");
    addDaily(ad.daily, metrics);
    if (index > 25e4) fail3("provider_row_limit");
  }
  const base = /* @__PURE__ */ __name((value2) => ({
    id: value2.id,
    name: value2.name,
    parentId: value2.parentId,
    status: value2.status,
    dailyMetrics: dailyRows(value2.daily)
  }), "base");
  const campaignsOutput = [...campaigns.values()].map((campaign) => ({
    ...base(campaign),
    adsets: [...campaign.children.values()].map((group) => ({
      ...base(group),
      ads: [...group.children.values()].map((ad) => ({ ...base(ad), creativeRef: ad.creativeRef }))
    }))
  }));
  return {
    accountCurrency,
    accountDaily: dailyRows(accountDaily),
    observedDates,
    campaigns: campaignsOutput
  };
}
__name(hierarchy, "hierarchy");
async function page(fetchImpl, endpoint, params, token, retry = {}) {
  const attempts = Number.isInteger(retry.maxAttempts) ? retry.maxAttempts : 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response5;
    try {
      response5 = await fetchImpl(`${endpoint}?${params}`, {
        method: "GET",
        headers: { accept: "application/json", authorization: `Bearer ${token}` }
      });
    } catch (_) {
      if (attempt === attempts) fail3("provider_unavailable");
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      continue;
    }
    if (!response5.ok) {
      if (RETRYABLE_STATUS.has(response5.status) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        continue;
      }
      fail3([401, 403].includes(response5.status) ? "provider_unauthorized" : response5.status === 429 ? "provider_rate_limited" : "provider_http_error");
    }
    try {
      return await response5.json();
    } catch (_) {
      fail3("provider_invalid_json");
    }
  }
  fail3("provider_unavailable");
}
__name(page, "page");
function createMetaAdsHierarchyAdapter({ accessToken, appSecret, fetchImpl = fetch, retry = {} } = {}) {
  const token = text2(accessToken);
  const secret = text2(appSecret);
  if (!token || !secret) return null;
  const proof = createHmac("sha256", secret).update(token).digest("hex");
  return async ({ integration, request }) => {
    const expectedAccountId = accountId(integration?.accountId);
    const from = isoDate2(request?.from);
    const to = isoDate2(request?.to);
    if (to < from) fail3("invalid_date_range");
    const apiVersion = text2(integration?.config?.apiVersion) || DEFAULT_API_VERSION;
    if (!/^v\d+\.\d+$/.test(apiVersion)) fail3("invalid_integration_config");
    const endpoint = `https://graph.facebook.com/${apiVersion}/act_${expectedAccountId}/insights`;
    const params = new URLSearchParams({
      appsecret_proof: proof,
      fields: "account_id,account_currency,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop,impressions,clicks,spend",
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since: from, until: to }),
      limit: "500"
    });
    const rows = [];
    const seenCursors = /* @__PURE__ */ new Set();
    let cursor = null;
    for (let pageNumber = 1; pageNumber <= 100; pageNumber += 1) {
      if (cursor) params.set("after", cursor);
      else params.delete("after");
      const payload = await page(fetchImpl, endpoint, params, token, retry);
      if (!Array.isArray(payload?.data)) fail3("provider_schema_mismatch");
      rows.push(...payload.data);
      const next = payload?.paging?.next;
      if (!next) {
        cursor = null;
        break;
      }
      let nextUrl;
      try {
        nextUrl = new URL(next);
      } catch (_) {
        fail3("pagination_scope_mismatch");
      }
      if (nextUrl.protocol !== "https:" || nextUrl.hostname !== "graph.facebook.com" || nextUrl.pathname !== new URL(endpoint).pathname) {
        fail3("pagination_scope_mismatch");
      }
      cursor = text2(nextUrl.searchParams.get("after"));
      if (!cursor || seenCursors.has(cursor)) fail3("pagination_cycle");
      seenCursors.add(cursor);
      if (pageNumber === 100) fail3("pagination_limit");
    }
    const normalized = hierarchy(rows, expectedAccountId);
    if (normalized.accountCurrency && integration.currency && normalized.accountCurrency !== integration.currency) {
      fail3("currency_scope_mismatch");
    }
    return {
      provider: "meta_ads",
      accountId: expectedAccountId,
      accountName: null,
      accountStatus: null,
      timezone: integration.timezone,
      currency: normalized.accountCurrency || integration.currency,
      coverage: "complete",
      unsupportedMetrics: ["conversions", "conversionValue"],
      dailyMetrics: normalized.accountDaily,
      campaigns: normalized.campaigns,
      missingRanges: missingRanges(from, to, normalized.observedDates),
      dataThroughDate: normalized.accountDaily.at(-1)?.date || null
    };
  };
}
__name(createMetaAdsHierarchyAdapter, "createMetaAdsHierarchyAdapter");
var META_ADS_HIERARCHY_INTERNALS = Object.freeze({ hierarchy, missingRanges });

// src/mvp.js
var JSON_HEADERS3 = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
var HOUSEVIP_PROJECT_TABS = /* @__PURE__ */ new Set([
  "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442 (SMM)",
  "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u043A\u043E\u043D\u0442\u0435\u043D\u0442-\u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F (SMM)",
  "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0444\u0438\u043B\u044F (SMM)",
  "\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043F\u043B\u0430\u043D \u043D\u0430 \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C (SMM)",
  "\u0422\u0435\u043A\u0441\u0442\u044B / \u041B\u0435\u043D\u0442\u0430 \u043D\u0430 \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C (SMM)",
  "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442 (Meta)",
  "\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Meta)",
  "\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043E\u0432 (Meta)",
  "\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F (Meta)",
  "\u041A\u0440\u0435\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0431\u0440\u0438\u0444 (Meta)"
]);
var COMMERCE_DATASET_CONTRACT = [
  { channel: "ecommerce", viewRole: "account", grain: "account_daily", legacyKey: "ecommerce_account" },
  { channel: "ecommerce", viewRole: "campaign", grain: "campaign_daily", legacyKey: "ecommerce_campaign" },
  { channel: "instashop", viewRole: "ads", grain: "campaign_daily", legacyKey: "instashop_ads" },
  { channel: "instashop", viewRole: "sales", grain: "project_daily", legacyKey: "instashop_sales" }
];
var PROJECT_PORTAL_ASSETS = /* @__PURE__ */ new Map([
  ["housevip-cxp7", { assetPath: "/housevip-cxp7/index.html", basePath: "/housevip-cxp7/" }],
  ["profkit-instashop-r4vk", { assetPath: "/profkit-instashop-r4vk/index.html", basePath: "/profkit-instashop-r4vk/" }],
  ["karlovarska-sul-k4rm", { assetPath: "/karlovarska-sul-k4rm/index.html", basePath: "/karlovarska-sul-k4rm/" }]
]);
function response3(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS3 });
}
__name(response3, "response");
function bearer(request) {
  const match = String(request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}
__name(bearer, "bearer");
function projectSet(value2) {
  return new Set(String(value2 || "").split(",").map((item) => item.trim()).filter(Boolean));
}
__name(projectSet, "projectSet");
function publicProjectMaterialAllowed(env, projectSlug) {
  return String(env.ENVIRONMENT || "") === "staging" && projectSet(env.MVP_PUBLIC_PROJECT_MATERIALS).has(projectSlug);
}
__name(publicProjectMaterialAllowed, "publicProjectMaterialAllowed");
var ACCESS_JWKS = /* @__PURE__ */ new Map();
function accessJwks(issuer) {
  let jwks = ACCESS_JWKS.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    ACCESS_JWKS.set(issuer, jwks);
  }
  return jwks;
}
__name(accessJwks, "accessJwks");
async function authorizeAccess(request, env, projectSlug, requiredRole) {
  const audience = String(env.CF_ACCESS_AUD || "");
  const issuer = String(env.CF_ACCESS_ISSUER || "").replace(/\/$/, "");
  const allowedEmails = new Set([...projectSet(env.MVP_ALLOWED_EMAILS)].map((item) => item.toLowerCase()));
  const token = String(request.headers.get("cf-access-jwt-assertion") || "");
  if (!audience || !issuer || !allowedEmails.size) {
    return { ok: false, status: 403, error: "access_auth_not_configured" };
  }
  if (!token) return { ok: false, status: 401, error: "access_authentication_required" };
  let issuerUrl;
  try {
    issuerUrl = new URL(issuer);
  } catch (_) {
    return { ok: false, status: 401, error: "invalid_access_issuer" };
  }
  if (issuerUrl.protocol !== "https:" || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuerUrl.hostname) || issuerUrl.origin !== issuer) {
    return { ok: false, status: 401, error: "invalid_access_issuer" };
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, accessJwks(issuer), {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 5
    }));
  } catch (_) {
    return { ok: false, status: 401, error: "invalid_access_token" };
  }
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !allowedEmails.has(email)) {
    return { ok: false, status: 403, error: "owner_email_forbidden" };
  }
  const editorScopes = projectSet(env.MVP_EDITOR_PROJECTS);
  const viewerScopes = projectSet(env.MVP_VIEW_PROJECTS);
  const role = editorScopes.has(projectSlug) ? "editor" : viewerScopes.has(projectSlug) ? "viewer" : null;
  if (!role) return { ok: false, status: 403, error: "project_scope_forbidden" };
  if (requiredRole === "editor" && role !== "editor") {
    return { ok: false, status: 403, error: "editor_role_required" };
  }
  return { ok: true, role, subject: `access:${String(payload.sub || "owner")}`, projectSlug };
}
__name(authorizeAccess, "authorizeAccess");
async function sha256Text3(value2) {
  const bytes = new TextEncoder().encode(value2);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Text3, "sha256Text");
async function authorizeMvp(request, env, projectSlug, requiredRole = "viewer", resource = "protected") {
  if (String(env.ENVIRONMENT || "") === "staging") {
    if (requiredRole === "viewer" && ["dashboard", "exchange-rate"].includes(resource)) {
      if (!["GET", "HEAD"].includes(request.method)) {
        return { ok: false, status: 403, error: "public_method_forbidden" };
      }
      if (projectSet(env.MVP_PUBLIC_VIEW_PROJECTS).has(projectSlug)) {
        return { ok: true, role: "public", subject: "public-read", projectSlug };
      }
      const protectedScopes = /* @__PURE__ */ new Set([
        ...projectSet(env.MVP_VIEW_PROJECTS),
        ...projectSet(env.MVP_EDITOR_PROJECTS)
      ]);
      if (!protectedScopes.has(projectSlug)) {
        return { ok: false, status: 403, error: "project_scope_forbidden" };
      }
    }
    return authorizeAccess(request, env, projectSlug, requiredRole);
  }
  if (!["local", "test"].includes(String(env.ENVIRONMENT || ""))) return { ok: false, status: 403, error: "mvp_auth_not_available" };
  const token = bearer(request);
  if (!token) return { ok: false, status: 401, error: "authentication_required" };
  const editorToken = String(env.MVP_EDITOR_TOKEN || "");
  const viewerToken = String(env.MVP_VIEW_TOKEN || "");
  let role = null;
  let scopes = /* @__PURE__ */ new Set();
  if (editorToken.length >= 24 && token === editorToken) {
    role = "editor";
    scopes = projectSet(env.MVP_EDITOR_PROJECTS);
  } else if (viewerToken.length >= 24 && token === viewerToken) {
    role = "viewer";
    scopes = projectSet(env.MVP_VIEW_PROJECTS);
  }
  if (!role) return { ok: false, status: 401, error: "invalid_token" };
  if (!scopes.has(projectSlug)) return { ok: false, status: 403, error: "project_scope_forbidden" };
  if (requiredRole === "editor" && role !== "editor") return { ok: false, status: 403, error: "editor_role_required" };
  return { ok: true, role, subject: `local-${role}`, projectSlug };
}
__name(authorizeMvp, "authorizeMvp");
function validDate(value2) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value2 || ""))) return false;
  const parsed = /* @__PURE__ */ new Date(`${value2}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value2;
}
__name(validDate, "validDate");
function decimal3(value2) {
  const text4 = String(value2);
  const match = text4.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`invalid decimal: ${text4}`);
  const fraction = match[3] || "";
  const integer = BigInt(`${match[1]}${match[2]}${fraction}`);
  return { integer, scale: fraction.length };
}
__name(decimal3, "decimal");
function power10(value2) {
  return 10n ** BigInt(value2);
}
__name(power10, "power10");
function decimalSum(values) {
  if (!values.length) return "0";
  const parsed = values.map(decimal3);
  const scale = Math.max(...parsed.map((item) => item.scale));
  const total = parsed.reduce((sum, item) => sum + item.integer * power10(scale - item.scale), 0n);
  const negative = total < 0n;
  const digits2 = (negative ? -total : total).toString().padStart(scale + 1, "0");
  const body = scale ? `${digits2.slice(0, -scale)}.${digits2.slice(-scale)}` : digits2;
  return `${negative ? "-" : ""}${body}`;
}
__name(decimalSum, "decimalSum");
function decimalRatio(numerator, denominator, scale = 6) {
  const a = decimal3(numerator);
  const b = decimal3(denominator);
  if (b.integer === 0n) return null;
  const scaled = a.integer * power10(b.scale + scale) / (b.integer * power10(a.scale));
  const negative = scaled < 0n;
  const digits2 = (negative ? -scaled : scaled).toString().padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${digits2.slice(0, -scale)}.${digits2.slice(-scale)}`;
}
__name(decimalRatio, "decimalRatio");
function metric(values, code) {
  return values.find((value2) => value2.metricCode === code);
}
__name(metric, "metric");
function aggregateMetric(rows, code) {
  const present = rows.map((row) => metric(row.metrics, code)).filter(Boolean);
  if (!present.length) return { code, value: null, state: "missing", reason: "not_in_release" };
  if (present.length !== rows.length) return { code, value: null, state: "missing", reason: "missing_component" };
  const unavailable2 = present.find((item) => item.state !== "observed");
  if (unavailable2) return { code, value: null, state: unavailable2.state, reason: unavailable2.reason || null };
  return {
    code,
    value: decimalSum(present.map((item) => item.value)),
    state: "observed",
    unit: present[0].unit,
    currency: present[0].currency || null,
    metricVersion: present[0].metricVersion
  };
}
__name(aggregateMetric, "aggregateMetric");
function effectiveFreshness(generation, asOfValue) {
  if (generation.freshness !== "fresh" || !validDate(generation.observedToExclusive)) return generation.freshness;
  const asOf = validDate(asOfValue) ? asOfValue : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const observedBoundary = Date.parse(`${generation.observedToExclusive}T00:00:00Z`);
  const asOfBoundary = Date.parse(`${asOf}T00:00:00Z`);
  return asOfBoundary - observedBoundary >= 2 * 864e5 ? "stale" : "fresh";
}
__name(effectiveFreshness, "effectiveFreshness");
function derivedMetric(code, numerator, denominator, multiplier = "1") {
  if (numerator.state !== "observed" || denominator.state !== "observed") {
    return { code, value: null, state: "missing", reason: "missing_component" };
  }
  if (decimal3(denominator.value).integer === 0n) {
    return { code, value: null, state: "missing", reason: "zero_denominator" };
  }
  const multiplied = decimalSum(Array(Number(multiplier)).fill(numerator.value));
  return { code, value: decimalRatio(multiplied, denominator.value), state: "observed", unit: "ratio" };
}
__name(derivedMetric, "derivedMetric");
async function projectRecord(env, slug2) {
  return env.TOYS_DB.prepare(
    `SELECT p.id, p.organization_id AS organizationId, p.client_id AS clientId, p.slug, p.name,
            p.project_type AS projectType, p.currency, p.timezone, p.default_locale AS defaultLocale, p.active_preset AS preset,
            p.capabilities_json AS capabilitiesJson, c.name AS clientName,
            cfg.id AS configRevisionId, cfg.revision_number AS configRevision, cfg.config_json AS configJson
       FROM projects p
       JOIN clients c ON c.id = p.client_id AND c.organization_id = p.organization_id
       JOIN dashboard_config_pointers cp ON cp.organization_id = p.organization_id AND cp.project_id = p.id
       JOIN dashboard_config_revisions cfg ON cfg.id = cp.revision_id
      WHERE p.slug = ? AND p.status = 'active'`
  ).bind(slug2).first();
}
__name(projectRecord, "projectRecord");
var adsServiceDb = null;
var adsService = null;
function onDemandAdsService(env) {
  if (adsServiceDb !== env.TOYS_DB || !adsService) {
    adsServiceDb = env.TOYS_DB;
    const metaAdapter = createMetaAdsHierarchyAdapter({
      accessToken: env.META_ADS_ACCESS_TOKEN,
      appSecret: env.META_APP_SECRET
    });
    adsService = createOnDemandAdsService({
      db: env.TOYS_DB,
      providers: metaAdapter ? { meta_ads: metaAdapter } : {},
      cacheTtlMinutes: 60
    });
  }
  return adsService;
}
__name(onDemandAdsService, "onDemandAdsService");
async function protectedProject(request, env, slug2, requiredRole = "viewer") {
  const auth = await authorizeMvp(request, env, slug2, requiredRole);
  if (!auth.ok) return { response: response3({ ok: false, error: auth.error }, auth.status) };
  const project = await projectRecord(env, slug2);
  if (!project) return { response: response3({ ok: false, error: "not_found" }, 404) };
  return { auth, project };
}
__name(protectedProject, "protectedProject");
function adsDateRange(url) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const defaultFrom = /* @__PURE__ */ new Date(`${today}T00:00:00.000Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  return {
    from: String(url.searchParams.get("from") || defaultFrom.toISOString().slice(0, 10)),
    to: String(url.searchParams.get("to") || today)
  };
}
__name(adsDateRange, "adsDateRange");
async function adsHierarchy(request, env, slug2, forceRefresh = false) {
  const scope = await protectedProject(request, env, slug2, forceRefresh ? "editor" : "viewer");
  if (scope.response) return scope.response;
  const range = adsDateRange(new URL(request.url));
  try {
    const result = await onDemandAdsService(env).getStats({
      organizationId: scope.project.organizationId,
      projectSlug: slug2,
      from: range.from,
      to: range.to,
      forceRefresh
    });
    return response3({ ok: true, ...result, access: { role: scope.auth.role } }, forceRefresh ? 202 : 200);
  } catch (error) {
    const code = error instanceof OnDemandAdsError ? error.code : "ads_request_failed";
    const status = ["invalid_date", "invalid_date_range", "invalid_metrics"].includes(code) ? 400 : 503;
    return response3({ ok: false, error: code }, status);
  }
}
__name(adsHierarchy, "adsHierarchy");
async function creativeCollection(request, env, slug2) {
  const scope = await protectedProject(request, env, slug2, request.method === "POST" ? "editor" : "viewer");
  if (scope.response) return scope.response;
  return request.method === "POST" ? createCreativeAsset(request, env, scope.auth, scope.project) : listCreativeAssets(request, env, scope.auth, scope.project);
}
__name(creativeCollection, "creativeCollection");
async function creativeResource(request, env, slug2, creativeId, action) {
  const editorAction = request.method === "PATCH" || request.method === "PUT";
  const scope = await protectedProject(request, env, slug2, editorAction ? "editor" : "viewer");
  if (scope.response) return scope.response;
  if (action === "preview") return getCreativePreview(request, env, scope.auth, scope.project, creativeId);
  if (action === "upload") return uploadCreativeAsset(request, env, scope.auth, scope.project, creativeId);
  if (action === "comments") {
    return request.method === "POST" ? createCreativeComment(request, env, scope.auth, scope.project, creativeId) : listCreativeComments(request, env, scope.auth, scope.project, creativeId);
  }
  return updateCreativeStatus(request, env, scope.auth, scope.project, creativeId);
}
__name(creativeResource, "creativeResource");
async function releaseRecord(env, project) {
  return env.TOYS_DB.prepare(
    `SELECT r.id, r.revision, r.manifest_json AS manifestJson, r.source_hash AS sourceHash,
            r.created_at AS createdAt
       FROM project_data_release_pointers p
       JOIN project_data_releases r ON r.id = p.release_id
      WHERE p.organization_id = ? AND p.project_id = ?`
  ).bind(project.organizationId, project.id).first();
}
__name(releaseRecord, "releaseRecord");
async function activeReleaseLineage(env, project) {
  const release = await releaseRecord(env, project);
  if (!release) return null;
  return {
    dataReleaseId: release.id,
    dataReleaseRevision: release.revision,
    sourceHash: release.sourceHash,
    createdAt: release.createdAt,
    manifest: JSON.parse(release.manifestJson || "{}")
  };
}
__name(activeReleaseLineage, "activeReleaseLineage");
function expectedDataRelease(body) {
  if (body?.expectedDataReleaseId == null) return { ok: true, id: null };
  const id = String(body.expectedDataReleaseId).trim();
  return id ? { ok: true, id } : { ok: false, id: null };
}
__name(expectedDataRelease, "expectedDataRelease");
async function checkedReleaseLineage(env, project, body) {
  const expected = expectedDataRelease(body);
  if (!expected.ok) return { ok: false, status: 400, error: "invalid_data_release" };
  const lineage = await activeReleaseLineage(env, project);
  if (!lineage) return { ok: false, status: 409, error: "no_published_release" };
  if (expected.id && lineage.dataReleaseId !== expected.id) {
    return { ok: false, status: 409, error: "data_release_changed", currentDataReleaseId: lineage.dataReleaseId };
  }
  return { ok: true, lineage, expectedDataReleaseId: expected.id };
}
__name(checkedReleaseLineage, "checkedReleaseLineage");
async function generationRecord(env, project, generationId) {
  return env.TOYS_DB.prepare(
    `SELECT g.id, g.source_stream_id AS sourceStreamId, g.availability, g.coverage, g.freshness,
            g.requested_from AS requestedFrom, g.requested_to_exclusive AS requestedToExclusive,
            g.observed_from AS observedFrom, g.observed_to_exclusive AS observedToExclusive,
            g.row_count AS rowCount, g.missing_ranges_json AS missingRangesJson,
            g.generated_at AS generatedAt, g.source_hash AS sourceHash,
            s.source_timezone AS sourceTimezone, s.channel_key AS channel, s.grain AS sourceGrain
       FROM data_generations g
       JOIN source_streams s
         ON s.organization_id = g.organization_id
        AND s.project_id = g.project_id
        AND s.id = g.source_stream_id
      WHERE g.organization_id = ? AND g.project_id = ? AND g.id = ? AND g.status = 'sealed'`
  ).bind(project.organizationId, project.id, generationId).first();
}
__name(generationRecord, "generationRecord");
async function factRows(env, project, generationId) {
  const result = await env.TOYS_DB.prepare(
    `SELECT o.id, o.local_date AS localDate, o.source_timezone AS sourceTimezone,
            o.grain, o.account_ref AS accountRef, o.provider_campaign_id AS providerCampaignId,
            o.legacy_group_ref AS legacyGroupRef, o.legacy_campaign_label AS legacyCampaignLabel,
            o.source_record_ref AS sourceRecordRef, o.source_hash AS sourceHash,
            v.metric_code AS metricCode, v.metric_version AS metricVersion,
            v.value_basis AS valueBasis, v.value_text AS value, v.scale, v.unit, v.currency,
            v.value_state AS state, v.quality_flags_json AS qualityFlagsJson
       FROM fact_observations o
       JOIN fact_values v ON v.observation_id = o.id
      WHERE o.organization_id = ? AND o.project_id = ? AND o.generation_id = ?
      ORDER BY o.local_date, o.id, v.metric_code`
  ).bind(project.organizationId, project.id, generationId).all();
  const grouped = /* @__PURE__ */ new Map();
  for (const value2 of result.results || []) {
    if (!grouped.has(value2.id)) {
      grouped.set(value2.id, {
        observationId: value2.id,
        date: value2.localDate,
        sourceTimezone: value2.sourceTimezone,
        grain: value2.grain,
        accountRef: value2.accountRef || null,
        campaign: {
          ref: value2.providerCampaignId || value2.legacyGroupRef || null,
          providerCampaignId: value2.providerCampaignId || null,
          legacyGroupRef: value2.legacyGroupRef || null,
          label: value2.legacyCampaignLabel || null,
          identityKind: value2.providerCampaignId ? "provider_campaign" : "legacy_group"
        },
        source: { recordRef: value2.sourceRecordRef, hash: value2.sourceHash },
        metrics: []
      });
    }
    grouped.get(value2.id).metrics.push({
      metricCode: value2.metricCode,
      metricVersion: value2.metricVersion,
      valueBasis: value2.valueBasis,
      value: value2.value,
      scale: value2.scale,
      unit: value2.unit,
      currency: value2.currency || null,
      state: value2.state,
      qualityFlags: JSON.parse(value2.qualityFlagsJson || "[]")
    });
  }
  return [...grouped.values()];
}
__name(factRows, "factRows");
function commerceDescriptorMap(manifest, synthetic) {
  if (!Array.isArray(manifest.datasets)) return { ok: false, reason: "datasets_required" };
  if (!synthetic && manifest.auxiliaryStreams != null && !Array.isArray(manifest.auxiliaryStreams)) {
    return { ok: false, reason: "invalid_auxiliary_streams" };
  }
  const values = synthetic ? manifest.datasets : [...manifest.datasets, ...manifest.auxiliaryStreams || []];
  const byRole = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Set();
  for (const value2 of values) {
    if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
      return { ok: false, reason: "invalid_descriptor" };
    }
    const legacy = synthetic ? COMMERCE_DATASET_CONTRACT.find((item) => item.legacyKey === value2.key) : null;
    const channel = String(value2.channelKey || value2.channel || legacy?.channel || "");
    const viewRole = String(value2.viewRole || legacy?.viewRole || "");
    const auxiliaryAdvertising = !synthetic && viewRole === "ads_campaign" && ["google", "meta"].includes(channel);
    const auxiliaryExchangeRate = !synthetic && viewRole === "exchange_rate" && channel === "instashop";
    const contract = auxiliaryAdvertising ? { channel, viewRole, grain: "campaign_daily" } : auxiliaryExchangeRate ? { channel, viewRole, grain: "project_daily" } : COMMERCE_DATASET_CONTRACT.find((item) => item.channel === channel && item.viewRole === viewRole);
    if (!contract || !value2.key || !value2.generationId || !value2.sourceStreamId) {
      return { ok: false, reason: "descriptor_contract_required", datasetKey: value2.key || null };
    }
    if (value2.grain !== contract.grain) {
      return { ok: false, reason: "descriptor_grain_mismatch", datasetKey: value2.key };
    }
    if (keys.has(value2.key)) return { ok: false, reason: "duplicate_dataset_key", datasetKey: value2.key };
    keys.add(value2.key);
    const roleKey = auxiliaryAdvertising ? `advertising:${channel}` : auxiliaryExchangeRate ? `exchange_rate:${channel}` : `${channel}:${viewRole}`;
    if (byRole.has(roleKey)) return { ok: false, reason: "duplicate_view_role", datasetKey: value2.key };
    byRole.set(roleKey, { ...value2, channel, channelKey: channel, viewRole, contract });
  }
  return { ok: true, byRole };
}
__name(commerceDescriptorMap, "commerceDescriptorMap");
function requiredCommerceChannels(project, descriptors, synthetic) {
  if (synthetic) return /* @__PURE__ */ new Set(["ecommerce", "instashop"]);
  const capabilities = new Set(JSON.parse(project.capabilitiesJson || "[]"));
  const required = /* @__PURE__ */ new Set();
  if (project.projectType === "ecommerce" || project.preset === "ecommerce" || capabilities.has("ecommerce")) required.add("ecommerce");
  if (project.projectType === "instashop" || project.preset === "instashop" || capabilities.has("instashop")) required.add("instashop");
  for (const descriptor of descriptors.values()) {
    if (["ecommerce", "instashop"].includes(descriptor.channel)) required.add(descriptor.channel);
  }
  return required;
}
__name(requiredCommerceChannels, "requiredCommerceChannels");
function validateCommerceRoles(project, descriptors, synthetic) {
  const channels = requiredCommerceChannels(project, descriptors, synthetic);
  for (const contract of COMMERCE_DATASET_CONTRACT) {
    if (channels.has(contract.channel) && !descriptors.has(`${contract.channel}:${contract.viewRole}`)) {
      return { ok: false, reason: "required_view_missing", datasetKey: contract.legacyKey };
    }
  }
  return channels.size ? { ok: true, channels } : { ok: false, reason: "commerce_dataset_required" };
}
__name(validateCommerceRoles, "validateCommerceRoles");
async function releaseDataset(env, project, descriptor, from, toExclusive, synthetic) {
  const generation = await generationRecord(env, project, descriptor.generationId);
  if (!generation) return { ok: false, reason: "generation_missing", datasetKey: descriptor.key };
  if (descriptor.sourceStreamId !== generation.sourceStreamId) {
    return { ok: false, reason: "source_stream_mismatch", datasetKey: descriptor.key };
  }
  if (descriptor.channel !== generation.channel) {
    return { ok: false, reason: "source_channel_mismatch", datasetKey: descriptor.key };
  }
  if (descriptor.grain !== generation.sourceGrain) {
    return { ok: false, reason: "source_grain_mismatch", datasetKey: descriptor.key };
  }
  const factMismatch = await env.TOYS_DB.prepare(
    `SELECT COUNT(*) AS invalidCount
       FROM fact_observations
      WHERE organization_id = ? AND project_id = ? AND generation_id = ?
        AND (source_stream_id <> ? OR grain <> ?)`
  ).bind(project.organizationId, project.id, generation.id, generation.sourceStreamId, descriptor.grain).first();
  if (Number(factMismatch?.invalidCount || 0) !== 0) {
    return { ok: false, reason: "fact_contract_mismatch", datasetKey: descriptor.key };
  }
  const rows = (await factRows(env, project, generation.id)).filter((row) => row.date >= from && row.date < toExclusive);
  if (rows.some((row) => row.grain !== descriptor.grain)) {
    return { ok: false, reason: "fact_grain_mismatch", datasetKey: descriptor.key };
  }
  const dataset = {
    key: descriptor.key,
    grain: descriptor.grain,
    sourceStreamId: generation.sourceStreamId,
    generationId: generation.id,
    sourceTimezone: generation.sourceTimezone,
    coverage: generation.coverage,
    freshness: synthetic ? generation.freshness : effectiveFreshness(generation, env.MVP_AS_OF_DATE),
    rows
  };
  if (!synthetic) {
    Object.assign(dataset, {
      channel: descriptor.channel,
      channelKey: descriptor.channelKey,
      viewRole: descriptor.viewRole,
      availability: generation.availability,
      requested: { from: generation.requestedFrom, toExclusive: generation.requestedToExclusive },
      observed: { from: generation.observedFrom, toExclusive: generation.observedToExclusive },
      missingRanges: JSON.parse(generation.missingRangesJson || "[]"),
      rowCount: generation.rowCount
    });
  }
  return { ok: true, dataset };
}
__name(releaseDataset, "releaseDataset");
function datasetCurrencies(datasets) {
  const result = {};
  for (const dataset of datasets) {
    for (const row of dataset?.rows || []) {
      for (const value2 of row.metrics || []) {
        if (!value2.currency) continue;
        if (!result[value2.metricCode]) result[value2.metricCode] = /* @__PURE__ */ new Set();
        result[value2.metricCode].add(value2.currency);
      }
    }
  }
  return Object.fromEntries(Object.entries(result).map(([code, currencies]) => [code, [...currencies].sort()]));
}
__name(datasetCurrencies, "datasetCurrencies");
function realCommerceCoverage(datasets, from, toExclusive) {
  const values = [...datasets.values()];
  const availability = values.every((item) => item.availability === "ok") ? "ok" : values.find((item) => item.availability === "error")?.availability || values.find((item) => item.availability !== "ok")?.availability || "ok";
  const status = values.every((item) => item.coverage === "complete") ? "complete" : values.some((item) => item.coverage === "partial") ? "partial" : "unknown";
  const freshness = values.some((item) => item.freshness === "stale") ? "stale" : "fresh";
  return {
    availability,
    status,
    freshness,
    requested: { from, toExclusive },
    observed: { from, toExclusive },
    missingRanges: values.flatMap((item) => item.missingRanges.map((range) => ({ dataset: item.key, ...range }))),
    warning: freshness === "stale" ? "\u041E\u0434\u0438\u043D \u0438\u043B\u0438 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0431\u043E\u0440\u043E\u0432 \u0434\u0430\u043D\u043D\u044B\u0445 \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0438; \u043F\u043E\u043A\u0430\u0437\u0430\u043D \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0439 release." : status !== "complete" ? "\u041D\u0430\u0431\u043E\u0440\u044B \u0434\u0430\u043D\u043D\u044B\u0445 \u0438\u043C\u0435\u044E\u0442 \u0440\u0430\u0437\u043D\u043E\u0435 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0435; \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0438 \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0443\u043B\u044F\u043C\u0438." : null
  };
}
__name(realCommerceCoverage, "realCommerceCoverage");
function publicCommerceDataset(dataset) {
  if (!dataset) return null;
  return {
    key: dataset.key,
    grain: dataset.grain,
    sourceTimezone: dataset.sourceTimezone,
    coverage: dataset.coverage,
    freshness: dataset.freshness,
    channel: dataset.channel,
    channelKey: dataset.channelKey,
    viewRole: dataset.viewRole,
    availability: dataset.availability,
    requested: dataset.requested,
    observed: dataset.observed,
    missingRanges: dataset.missingRanges,
    rowCount: dataset.rowCount,
    rows: (dataset.rows || []).map((row) => ({
      date: row.date,
      grain: row.grain,
      ...row.campaign?.label ? { campaign: { label: row.campaign.label } } : {},
      metrics: (row.metrics || []).map((value2) => ({
        metricCode: value2.metricCode,
        value: value2.value,
        scale: value2.scale,
        unit: value2.unit,
        currency: value2.currency,
        state: value2.state,
        qualityFlags: value2.qualityFlags
      }))
    }))
  };
}
__name(publicCommerceDataset, "publicCommerceDataset");
function publicCommerceDashboard(model) {
  const dashboard2 = {
    schemaVersion: model.schemaVersion,
    access: model.access,
    project: {
      slug: model.project.slug,
      name: model.project.name,
      clientName: model.project.clientName,
      preset: model.project.preset,
      capabilities: model.project.capabilities,
      reportingTimezone: model.project.reportingTimezone,
      sourceTimezone: model.project.sourceTimezone,
      locale: model.project.locale
    },
    range: model.range,
    coverage: model.coverage,
    facts: publicCommerceDataset(model.facts)
  };
  if (model.ecommerce) {
    dashboard2.ecommerce = {
      viewsAreAlternative: true,
      warning: model.ecommerce.warning,
      account: publicCommerceDataset(model.ecommerce.account),
      campaigns: publicCommerceDataset(model.ecommerce.campaigns),
      currencyPolicy: model.ecommerce.currencyPolicy
    };
  }
  if (model.instashop) {
    dashboard2.instashop = {
      ads: publicCommerceDataset(model.instashop.ads),
      sales: publicCommerceDataset(model.instashop.sales),
      campaignSales: model.instashop.campaignSales,
      currencyPolicy: model.instashop.currencyPolicy
    };
  }
  if (model.advertising) {
    dashboard2.advertising = {
      channels: Object.fromEntries(Object.entries(model.advertising.channels || {}).map(([key, dataset]) => [key, publicCommerceDataset(dataset)])),
      currencyPolicy: model.advertising.currencyPolicy
    };
  }
  if (model.auxiliary?.exchangeRates) {
    dashboard2.auxiliary = {
      exchangeRates: Object.fromEntries(Object.entries(model.auxiliary.exchangeRates).map(([key, dataset]) => [key, publicCommerceDataset(dataset)]))
    };
  }
  return dashboard2;
}
__name(publicCommerceDashboard, "publicCommerceDashboard");
async function commerceDashboard(env, project, release, manifest, url, auth, synthetic) {
  const normalized = commerceDescriptorMap(manifest, synthetic);
  if (!normalized.ok) {
    return response3({ ok: false, error: "invalid_release_dataset", reason: normalized.reason, datasetKey: normalized.datasetKey || null }, 500);
  }
  const roles = validateCommerceRoles(project, normalized.byRole, synthetic);
  if (!roles.ok) {
    return response3({ ok: false, error: "invalid_release_dataset", reason: roles.reason, datasetKey: roles.datasetKey || null }, 500);
  }
  const requested = manifest.requestedRange || {};
  const firstDescriptor = normalized.byRole.values().next().value;
  const firstGeneration = !requested.from || !requested.toExclusive ? await generationRecord(env, project, firstDescriptor.generationId) : null;
  const from = url.searchParams.get("from") || requested.from || firstGeneration?.observedFrom;
  const toExclusive = url.searchParams.get("toExclusive") || requested.toExclusive || firstGeneration?.observedToExclusive;
  if (!validDate(from) || !validDate(toExclusive) || from >= toExclusive) {
    return response3({ ok: false, error: "invalid_range" }, 400);
  }
  const loaded = await Promise.all([...normalized.byRole.entries()].map(async ([roleKey, descriptor]) => [roleKey, await releaseDataset(env, project, descriptor, from, toExclusive, synthetic)]));
  const invalid2 = loaded.find(([, result]) => !result.ok);
  if (invalid2) {
    const detail = invalid2[1];
    const error = detail.reason === "generation_missing" ? "release_generation_missing" : "invalid_release_dataset";
    return response3({ ok: false, error, reason: detail.reason, datasetKey: detail.datasetKey }, 500);
  }
  const datasets = new Map(loaded.map(([roleKey, result]) => [roleKey, result.dataset]));
  const ecommerceAccount = datasets.get("ecommerce:account");
  const ecommerceCampaign = datasets.get("ecommerce:campaign");
  const instashopAds = datasets.get("instashop:ads");
  const instashopSales = datasets.get("instashop:sales");
  const advertisingChannels = new Map(
    [...datasets.entries()].filter(([roleKey]) => roleKey.startsWith("advertising:")).map(([, dataset]) => [dataset.channelKey, dataset])
  );
  const exchangeRateStreams = new Map(
    [...datasets.entries()].filter(([roleKey]) => roleKey.startsWith("exchange_rate:")).map(([, dataset]) => [dataset.channelKey, dataset])
  );
  const config = JSON.parse(project.configJson || "{}");
  const dashboardModel = {
    schemaVersion: "toys-commerce-dashboard/1.0",
    access: { role: auth.role },
    ...synthetic ? { demo: { synthetic: true, containsRealClientData: false, label: "\u0421\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 demo dataset" } } : {},
    configRevision: { id: project.configRevisionId, revision: project.configRevision },
    dataReleaseRef: { id: release.id, revision: release.revision, sourceHash: release.sourceHash, createdAt: release.createdAt },
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      clientId: project.clientId,
      clientName: project.clientName,
      preset: project.preset,
      capabilities: JSON.parse(project.capabilitiesJson || "[]"),
      reportingTimezone: project.timezone,
      sourceTimezone: synthetic ? "Europe/Kyiv" : (ecommerceCampaign || ecommerceAccount || instashopAds || instashopSales)?.sourceTimezone || null,
      locale: project.defaultLocale
    },
    range: { from, toExclusive },
    coverage: synthetic ? {
      availability: "ok",
      status: "complete",
      freshness: "fresh",
      requested: { from, toExclusive },
      observed: { from, toExclusive },
      missingRanges: [],
      warning: "\u0422\u043E\u043B\u044C\u043A\u043E \u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435: \u044D\u043A\u0440\u0430\u043D \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043A\u043E\u043D\u0442\u0440\u0430\u043A\u0442\u0430 \u0438 UI."
    } : realCommerceCoverage(datasets, from, toExclusive),
    facts: ecommerceCampaign || instashopAds || instashopSales,
    ...ecommerceAccount && ecommerceCampaign ? {
      ecommerce: {
        viewsAreAlternative: true,
        warning: "Account daily \u0438 campaign daily \u2014 \u0430\u043B\u044C\u0442\u0435\u0440\u043D\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u0438\u0445 \u043D\u0435\u043B\u044C\u0437\u044F \u0441\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u0442\u044C.",
        account: ecommerceAccount,
        campaigns: ecommerceCampaign,
        ...!synthetic ? { currencyPolicy: { mode: "native_separate", additive: false, currenciesByMetric: datasetCurrencies([ecommerceAccount, ecommerceCampaign]) } } : {}
      }
    } : {},
    ...instashopAds && instashopSales ? {
      instashop: {
        ads: instashopAds,
        sales: instashopSales,
        campaignSales: { state: "unsupported", reason: "sales_are_project_daily" },
        currencyPolicy: {
          spendUahMetric: "ads.spend_uah",
          rawSpendUsdMetric: "ads.raw_spend_usd",
          additive: false,
          ...!synthetic ? { mode: "native_separate", currenciesByMetric: datasetCurrencies([instashopAds, instashopSales]) } : {}
        }
      }
    } : {},
    ...advertisingChannels.size ? {
      advertising: {
        channels: Object.fromEntries(advertisingChannels),
        currencyPolicy: {
          mode: "native_separate",
          additive: false,
          currenciesByMetric: datasetCurrencies([...advertisingChannels.values()])
        }
      }
    } : {},
    ...exchangeRateStreams.size ? {
      auxiliary: { exchangeRates: Object.fromEntries(exchangeRateStreams) }
    } : {},
    presentation: config
  };
  if (auth.role === "public" && !synthetic) {
    return response3({ ok: true, dashboard: publicCommerceDashboard(dashboardModel) });
  }
  return response3({ ok: true, dashboard: dashboardModel });
}
__name(commerceDashboard, "commerceDashboard");
async function dashboard(request, env, slug2) {
  const auth = await authorizeMvp(request, env, slug2, "viewer", "dashboard");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const url = new URL(request.url);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const release = await releaseRecord(env, project);
  if (!release) return response3({ ok: false, error: "no_published_release" }, 409);
  const manifest = JSON.parse(release.manifestJson || "{}");
  const capabilities = JSON.parse(project.capabilitiesJson || "[]");
  const syntheticCommerce = manifest.synthetic === true && capabilities.includes("synthetic_demo");
  const realCommerce = manifest.synthetic !== true && (["ecommerce", "instashop"].includes(project.projectType) || ["ecommerce", "instashop"].includes(project.preset) || capabilities.some((item) => ["ecommerce", "instashop"].includes(item)));
  if (syntheticCommerce || realCommerce) {
    return commerceDashboard(env, project, release, manifest, url, auth, syntheticCommerce);
  }
  const generationId = manifest.datasets?.[0]?.generationId;
  const generation = generationId ? await generationRecord(env, project, generationId) : null;
  if (!generation) return response3({ ok: false, error: "release_generation_missing" }, 500);
  const from = url.searchParams.get("from") || generation.observedFrom;
  const toExclusive = url.searchParams.get("toExclusive") || generation.observedToExclusive;
  if (!validDate(from) || !validDate(toExclusive) || from >= toExclusive) {
    return response3({ ok: false, error: "invalid_range" }, 400);
  }
  const channel = url.searchParams.get("channel");
  if (channel && !["all", "meta"].includes(channel)) {
    return response3({ ok: false, error: "incompatible_filter", reason: "channel_not_in_release" }, 400);
  }
  if (url.searchParams.get("accountRef")) {
    return response3({ ok: false, error: "incompatible_filter", reason: "account_mapping_unknown" }, 400);
  }
  let rows = (await factRows(env, project, generation.id)).filter((row) => row.date >= from && row.date < toExclusive);
  const campaignRef = url.searchParams.get("campaignRef");
  if (campaignRef) rows = rows.filter((row) => row.campaign.ref === campaignRef);
  const impressions = aggregateMetric(rows, "ads.impressions");
  const clicks = aggregateMetric(rows, "ads.clicks");
  const spend = aggregateMetric(rows, "ads.spend");
  const conversions = aggregateMetric(rows, "ads.reported_conversions");
  const ctr = derivedMetric("ads.ctr", clicks, impressions, "100");
  const cpa = derivedMetric("ads.cpa", spend, conversions);
  const freshness = effectiveFreshness(generation, env.MVP_AS_OF_DATE);
  const coverage = {
    availability: generation.availability,
    status: generation.coverage,
    freshness,
    requested: { from: generation.requestedFrom, toExclusive: generation.requestedToExclusive },
    observed: { from: generation.observedFrom, toExclusive: generation.observedToExclusive },
    missingRanges: JSON.parse(generation.missingRangesJson || "[]"),
    rowCount: generation.rowCount,
    warning: freshness === "stale" ? "\u041E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0430 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0434\u0430\u0442\u044B \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430; \u043F\u043E\u043A\u0430\u0437\u0430\u043D \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0439 release." : generation.coverage === "partial" ? "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u043A\u043D\u0430; \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0438 \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0443\u043B\u044F\u043C\u0438." : null
  };
  const dashboardModel = {
    schemaVersion: "toys-dashboard/2.0",
    access: { role: auth.role },
    configRevision: { id: project.configRevisionId, revision: project.configRevision },
    dataReleaseRef: { id: release.id, revision: release.revision, sourceHash: release.sourceHash, createdAt: release.createdAt },
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      clientId: project.clientId,
      clientName: project.clientName,
      preset: project.preset,
      capabilities: JSON.parse(project.capabilitiesJson || "[]"),
      reportingTimezone: project.timezone,
      sourceTimezone: generation.sourceTimezone || rows[0]?.sourceTimezone || null,
      locale: project.defaultLocale
    },
    range: { from, toExclusive },
    coverage,
    panels: [spend, impressions, clicks, ctr, conversions, cpa].map((panel) => ({ ...panel, origin: { releaseId: release.id, generationId: generation.id }, coverage: generation.coverage, freshness })),
    facts: { grain: "campaign_daily", rows }
  };
  if (auth.role === "public") {
    const allowedMetrics = /* @__PURE__ */ new Set(["ads.spend", "ads.impressions", "ads.clicks", "ads.reported_conversions"]);
    return response3({
      ok: true,
      dashboard: {
        schemaVersion: dashboardModel.schemaVersion,
        access: dashboardModel.access,
        project: {
          slug: project.slug,
          name: project.name,
          reportingTimezone: project.timezone,
          sourceTimezone: generation.sourceTimezone || rows[0]?.sourceTimezone || null,
          locale: project.defaultLocale
        },
        range: dashboardModel.range,
        coverage: dashboardModel.coverage,
        panels: dashboardModel.panels.filter((panel) => allowedMetrics.has(panel.code)).map(({ code, value: value2, state, reason, unit, currency: currency3, coverage: panelCoverage, freshness: panelFreshness }) => ({
          code,
          value: value2,
          state,
          reason,
          unit,
          currency: currency3,
          coverage: panelCoverage,
          freshness: panelFreshness
        })),
        facts: {
          grain: "campaign_daily",
          rows: rows.map((row) => ({
            date: row.date,
            campaign: { label: row.campaign.label },
            metrics: row.metrics.filter((item) => allowedMetrics.has(item.metricCode)).map(({ metricCode, value: value2, unit, currency: currency3, state }) => ({ metricCode, value: value2, unit, currency: currency3, state }))
          }))
        }
      }
    });
  }
  return response3({
    ok: true,
    dashboard: dashboardModel
  });
}
__name(dashboard, "dashboard");
async function contentItem(env, project, logicalKey) {
  return env.TOYS_DB.prepare(
    `SELECT id, organization_id AS organizationId, project_id AS projectId, channel_key AS channelKey,
            locale, kind, logical_key AS logicalKey, title, period_kind AS periodKind,
            period_start AS periodStart, period_end AS periodEnd,
            latest_revision_number AS latestRevision, published_revision_id AS publishedRevisionId
       FROM content_items
      WHERE organization_id = ? AND project_id = ? AND logical_key = ? AND lifecycle = 'active'`
  ).bind(project.organizationId, project.id, logicalKey).first();
}
__name(contentItem, "contentItem");
async function revisionModel(env, item, revisionId) {
  if (!revisionId) return null;
  const revision = await env.TOYS_DB.prepare(
    `SELECT id, revision_number AS revisionNumber, parent_revision_id AS parentRevisionId,
            status, author_ref AS authorRef, reason, created_at AS createdAt,
            data_snapshot_manifest_json AS dataSnapshotManifestJson
       FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id = ?`
  ).bind(item.organizationId, item.projectId, item.id, revisionId).first();
  if (!revision) return null;
  const blocks = await env.TOYS_DB.prepare(
    `SELECT id, block_key AS blockKey, position, block_type AS type,
            payload_schema_version AS payloadSchemaVersion, payload_json AS payloadJson
       FROM content_blocks
      WHERE organization_id = ? AND project_id = ? AND revision_id = ?
      ORDER BY position, block_key`
  ).bind(item.organizationId, item.projectId, revision.id).all();
  return {
    ...revision,
    dataSnapshotManifest: revision.dataSnapshotManifestJson ? JSON.parse(revision.dataSnapshotManifestJson) : null,
    blocks: (blocks.results || []).map((block) => ({ ...block, payload: JSON.parse(block.payloadJson), payloadJson: void 0 }))
  };
}
__name(revisionModel, "revisionModel");
function publicWeeklyRevision(revision) {
  if (!revision || revision.status !== "published") return null;
  const knownFixture = revision.id === "content_housevip_weekly_rev_1" && Number(revision.revisionNumber) === 1 && revision.authorRef === "snapshot-importer";
  if (knownFixture) return null;
  const summaryBlock = revision.blocks.find((block) => block.type === "period_summary");
  const payload = summaryBlock?.payload;
  if (!payload || !validDate(payload.periodStart) || !validDate(payload.periodEnd) || payload.periodStart > payload.periodEnd) {
    return null;
  }
  const hasContent = ["summary", "wins", "issues", "changes", "nextSteps"].some((key) => String(payload[key] || "").trim());
  if (!hasContent) return null;
  return {
    revisionNumber: revision.revisionNumber,
    status: "published",
    createdAt: revision.createdAt,
    blocks: revision.blocks.map((block) => ({
      blockKey: block.blockKey,
      position: block.position,
      type: block.type,
      payloadSchemaVersion: block.payloadSchemaVersion,
      payload: block.payload
    }))
  };
}
__name(publicWeeklyRevision, "publicWeeklyRevision");
async function publishedContent(request, env, slug2) {
  const publicRead = publicProjectMaterialAllowed(env, slug2);
  const auth = publicRead ? { ok: true, role: "public_viewer" } : await authorizeMvp(request, env, slug2, "viewer");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const logicalKey = new URL(request.url).searchParams.get("logicalKey");
  if (!logicalKey) return response3({ ok: false, error: "logical_key_required" }, 400);
  if (publicRead && logicalKey !== "weekly-main") {
    return response3({ ok: false, error: "project_material_forbidden" }, 403);
  }
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const revision = await revisionModel(env, item, item.publishedRevisionId);
  if (publicRead) {
    const publicRevision = publicWeeklyRevision(revision);
    return response3({
      ok: true,
      schemaVersion: "toys-content/1.0",
      access: { role: auth.role },
      item: {
        logicalKey: item.logicalKey,
        title: item.title,
        channelKey: item.channelKey,
        locale: item.locale,
        periodKind: item.periodKind,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd
      },
      publishedRevision: publicRevision
    });
  }
  return response3({ ok: true, schemaVersion: "toys-content/1.0", access: { role: auth.role }, item, publishedRevision: revision });
}
__name(publishedContent, "publishedContent");
async function revisionHistory(request, env, slug2, logicalKey) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const result = await env.TOYS_DB.prepare(
    `SELECT id, revision_number AS revisionNumber, parent_revision_id AS parentRevisionId,
            status, author_ref AS authorRef, reason, created_at AS createdAt
       FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ?
      ORDER BY revision_number DESC`
  ).bind(project.organizationId, project.id, item.id).all();
  return response3({ ok: true, item: { logicalKey: item.logicalKey, publishedRevisionId: item.publishedRevisionId, latestRevision: item.latestRevision }, revisions: result.results || [] });
}
__name(revisionHistory, "revisionHistory");
async function contentComments(request, env, slug2, logicalKey) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  if (request.method === "GET") return listContentComments(request, env, auth, project, item);
  if (request.method === "POST") return createContentComment(request, env, auth, project, item);
  return response3({ ok: false, error: "method_not_allowed" }, 405);
}
__name(contentComments, "contentComments");
async function revisionDetail(request, env, slug2, logicalKey, revisionId) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const revision = await revisionModel(env, item, revisionId);
  if (!revision) return response3({ ok: false, error: "revision_not_found" }, 404);
  return response3({
    ok: true,
    item: { logicalKey: item.logicalKey, publishedRevisionId: item.publishedRevisionId, latestRevision: item.latestRevision },
    revision
  });
}
__name(revisionDetail, "revisionDetail");
function validateBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > 8) throw new Error("blocks_required");
  const allowed = /* @__PURE__ */ new Set(["rich_text", "task_list", "period_summary", "typed_table", "metric_snapshot"]);
  return blocks.map((block, index) => {
    const type = String(block?.type || "");
    const blockKey = String(block?.blockKey || `block-${index + 1}`).trim();
    if (!allowed.has(type) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(blockKey)) throw new Error("invalid_block");
    const payload = block?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_block_payload");
    if (type === "period_summary") {
      const periodStart = payload.periodStart == null ? "" : String(payload.periodStart);
      const periodEnd = payload.periodEnd == null ? "" : String(payload.periodEnd);
      if ((periodStart || periodEnd) && (!validDate(periodStart) || !validDate(periodEnd) || periodStart > periodEnd)) {
        throw new Error("invalid_period");
      }
    }
    const encoded = JSON.stringify(payload);
    if (encoded.length > 25e3) throw new Error("block_too_large");
    return { type, blockKey, position: index, payload };
  });
}
__name(validateBlocks, "validateBlocks");
async function parseBody3(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}
__name(parseBody3, "parseBody");
async function storedIdempotency3(env, project, action, key, requestHash) {
  if (!key) return null;
  const row = await env.TOYS_DB.prepare(
    `SELECT request_hash AS requestHash, response_json AS responseJson FROM api_idempotency_keys
      WHERE organization_id = ? AND project_id = ? AND action = ? AND idempotency_key = ?`
  ).bind(project.organizationId, project.id, action, key).first();
  if (!row) return null;
  return row.requestHash === requestHash ? { response: JSON.parse(row.responseJson), conflict: false } : { response: null, conflict: true };
}
__name(storedIdempotency3, "storedIdempotency");
async function createRevision(request, env, slug2, logicalKey) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const body = await parseBody3(request);
  if (!body) return response3({ ok: false, error: "invalid_json" }, 400);
  const expectedRevision = Number(body.expectedRevision);
  const idempotencyKey2 = String(request.headers.get("x-idempotency-key") || body.idempotencyKey || "");
  if (!Number.isInteger(expectedRevision) || idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    return response3({ ok: false, error: "invalid_revision_request" }, 400);
  }
  let blocks;
  try {
    blocks = validateBlocks(body.blocks);
  } catch (error) {
    return response3({ ok: false, error: error instanceof Error ? error.message : "invalid_blocks" }, 400);
  }
  const reason = String(body.reason || "").slice(0, 500);
  const expectedRelease = expectedDataRelease(body);
  if (!expectedRelease.ok) return response3({ ok: false, error: "invalid_data_release" }, 400);
  const requestHash = await sha256Text3(JSON.stringify({ expectedRevision, expectedDataReleaseId: expectedRelease.id, reason, blocks }));
  const stored = await storedIdempotency3(env, project, `content-revision:${item.id}`, idempotencyKey2, requestHash);
  if (stored?.conflict) return response3({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response3(stored.response);
  const releaseCheck = await checkedReleaseLineage(env, project, body);
  if (!releaseCheck.ok) return response3({ ok: false, error: releaseCheck.error, currentDataReleaseId: releaseCheck.currentDataReleaseId }, releaseCheck.status);
  if (item.latestRevision !== expectedRevision) {
    return response3({ ok: false, error: "revision_conflict", expectedRevision, currentRevision: item.latestRevision }, 409);
  }
  const lineage = releaseCheck.lineage;
  const parent = await env.TOYS_DB.prepare(
    `SELECT id FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND revision_number = ?`
  ).bind(project.organizationId, project.id, item.id, expectedRevision).first();
  const revisionNumber = expectedRevision + 1;
  const revisionId = crypto.randomUUID();
  const resultBody = {
    ok: true,
    revision: { id: revisionId, revisionNumber, parentRevisionId: parent?.id || null, status: "draft", blocks }
  };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items SET latest_revision_number = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ? AND latest_revision_number = ?`
    ).bind(revisionNumber, project.organizationId, project.id, item.id, expectedRevision),
    env.TOYS_DB.prepare(
      `INSERT INTO content_revisions
        (id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json,data_snapshot_manifest_json)
       VALUES (?,?,?,?,?,?,?,'draft',?,?, '[]',?)`
    ).bind(revisionId, project.organizationId, project.id, item.id, revisionNumber, parent?.id || null, "1", auth.subject, reason, JSON.stringify(lineage)),
    ...blocks.map((block) => env.TOYS_DB.prepare(
      `INSERT INTO content_blocks
        (id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json)
       VALUES (?,?,?,?,?,?,?,'1',?)`
    ).bind(crypto.randomUUID(), project.organizationId, project.id, revisionId, block.blockKey, block.position, block.type, JSON.stringify(block.payload))),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       VALUES (?,?,?,?,?,?)`
    ).bind(project.organizationId, project.id, `content-revision:${item.id}`, idempotencyKey2, requestHash, JSON.stringify(resultBody))
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1) throw new Error("revision_conflict");
  } catch (error) {
    const current = await contentItem(env, project, logicalKey);
    return response3({ ok: false, error: "revision_conflict", expectedRevision, currentRevision: current?.latestRevision ?? null }, 409);
  }
  return response3(resultBody, 201);
}
__name(createRevision, "createRevision");
async function publishRevision(request, env, slug2, logicalKey, revisionId) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const target = await revisionModel(env, item, revisionId);
  if (!target) return response3({ ok: false, error: "revision_not_found" }, 404);
  const body = await parseBody3(request);
  if (!body) return response3({ ok: false, error: "invalid_json" }, 400);
  const expectedPublishedRevisionId = body.expectedPublishedRevisionId == null ? null : String(body.expectedPublishedRevisionId);
  const idempotencyKey2 = String(request.headers.get("x-idempotency-key") || body.idempotencyKey || "");
  if (idempotencyKey2.length < 8 || idempotencyKey2.length > 200) return response3({ ok: false, error: "idempotency_key_required" }, 400);
  const reason = String(body.reason || "").slice(0, 500);
  const expectedRelease = expectedDataRelease(body);
  if (!expectedRelease.ok) return response3({ ok: false, error: "invalid_data_release" }, 400);
  const action = `content-publish:${item.id}`;
  const requestHash = await sha256Text3(JSON.stringify({ revisionId, expectedPublishedRevisionId, expectedDataReleaseId: expectedRelease.id, reason }));
  const stored = await storedIdempotency3(env, project, action, idempotencyKey2, requestHash);
  if (stored?.conflict) return response3({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response3(stored.response);
  const releaseCheck = await checkedReleaseLineage(env, project, body);
  if (!releaseCheck.ok) return response3({ ok: false, error: releaseCheck.error, currentDataReleaseId: releaseCheck.currentDataReleaseId }, releaseCheck.status);
  if (releaseCheck.expectedDataReleaseId && target.dataSnapshotManifest?.dataReleaseId !== releaseCheck.expectedDataReleaseId) {
    return response3({ ok: false, error: "revision_data_release_mismatch" }, 409);
  }
  if ((item.publishedRevisionId || null) !== expectedPublishedRevisionId) {
    return response3({ ok: false, error: "publish_conflict", expectedPublishedRevisionId, currentPublishedRevisionId: item.publishedRevisionId }, 409);
  }
  const resultBody = { ok: true, publishedRevisionId: revisionId, previousPublishedRevisionId: item.publishedRevisionId };
  const eventId = crypto.randomUUID();
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items SET published_revision_id = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ?
          AND ((published_revision_id = ?) OR (published_revision_id IS NULL AND ? IS NULL))`
    ).bind(revisionId, project.organizationId, project.id, item.id, expectedPublishedRevisionId, expectedPublishedRevisionId),
    env.TOYS_DB.prepare(
      `UPDATE content_revisions SET status = 'published'
        WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id = ?
          AND changes() = 1`
    ).bind(project.organizationId, project.id, item.id, revisionId),
    env.TOYS_DB.prepare(
      `UPDATE content_revisions SET status = 'archived'
        WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id <> ? AND status = 'published'
          AND EXISTS (SELECT 1 FROM content_items WHERE organization_id = ? AND project_id = ? AND id = ? AND published_revision_id = ?)`
    ).bind(project.organizationId, project.id, item.id, revisionId, project.organizationId, project.id, item.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_publication_events
        (id,organization_id,project_id,content_item_id,event_type,revision_id,previous_revision_id,source_revision_id,actor_ref,reason,idempotency_key)
       SELECT ?,?,?,?,'publish',?,?,NULL,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_items WHERE organization_id = ? AND project_id = ? AND id = ? AND published_revision_id = ?
       )`
    ).bind(eventId, project.organizationId, project.id, item.id, revisionId, item.publishedRevisionId, auth.subject, reason, idempotencyKey2, project.organizationId, project.id, item.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       SELECT ?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_publication_events WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(project.organizationId, project.id, action, idempotencyKey2, requestHash, JSON.stringify(resultBody), project.organizationId, project.id, eventId)
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.at(-1)?.meta?.changes || 0) !== 1) {
      throw new Error("publish_conflict");
    }
  } catch (_) {
    const current = await contentItem(env, project, logicalKey);
    return response3({ ok: false, error: "publish_conflict", currentPublishedRevisionId: current?.publishedRevisionId ?? null }, 409);
  }
  const readbackItem = await contentItem(env, project, logicalKey);
  const readback2 = await revisionModel(env, readbackItem, readbackItem.publishedRevisionId);
  return response3({ ...resultBody, readback: readback2 });
}
__name(publishRevision, "publishRevision");
async function saveAndPublishRevision(request, env, slug2, logicalKey) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const body = await parseBody3(request);
  if (!body) return response3({ ok: false, error: "invalid_json" }, 400);
  const expectedRevision = Number(body.expectedRevision);
  const expectedPublishedRevisionId = body.expectedPublishedRevisionId == null ? null : String(body.expectedPublishedRevisionId);
  const idempotencyKey2 = String(request.headers.get("x-idempotency-key") || body.idempotencyKey || "");
  if (!Number.isInteger(expectedRevision) || idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    return response3({ ok: false, error: "invalid_revision_request" }, 400);
  }
  let blocks;
  try {
    blocks = validateBlocks(body.blocks);
  } catch (error) {
    return response3({ ok: false, error: error instanceof Error ? error.message : "invalid_blocks" }, 400);
  }
  const reason = String(body.reason || "").slice(0, 500);
  const expectedRelease = expectedDataRelease(body);
  if (!expectedRelease.ok) return response3({ ok: false, error: "invalid_data_release" }, 400);
  const requestHash = await sha256Text3(JSON.stringify({ expectedRevision, expectedPublishedRevisionId, expectedDataReleaseId: expectedRelease.id, reason, blocks }));
  const action = `content-save-publish:${item.id}`;
  const stored = await storedIdempotency3(env, project, action, idempotencyKey2, requestHash);
  if (stored?.conflict) return response3({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) return response3(stored.response);
  const releaseCheck = await checkedReleaseLineage(env, project, body);
  if (!releaseCheck.ok) return response3({ ok: false, error: releaseCheck.error, currentDataReleaseId: releaseCheck.currentDataReleaseId }, releaseCheck.status);
  if (item.latestRevision !== expectedRevision || (item.publishedRevisionId || null) !== expectedPublishedRevisionId) {
    return response3({
      ok: false,
      error: "revision_conflict",
      expectedRevision,
      currentRevision: item.latestRevision,
      expectedPublishedRevisionId,
      currentPublishedRevisionId: item.publishedRevisionId
    }, 409);
  }
  const lineage = releaseCheck.lineage;
  const parent = await env.TOYS_DB.prepare(
    `SELECT id FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND revision_number = ?`
  ).bind(project.organizationId, project.id, item.id, expectedRevision).first();
  const revisionId = crypto.randomUUID();
  const revisionNumber = expectedRevision + 1;
  const resultBody = { ok: true, revision: { id: revisionId, revisionNumber, parentRevisionId: parent?.id || null, status: "published" } };
  const eventId = crypto.randomUUID();
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items
          SET latest_revision_number = ?, published_revision_id = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ? AND latest_revision_number = ?
          AND ((published_revision_id = ?) OR (published_revision_id IS NULL AND ? IS NULL))`
    ).bind(revisionNumber, revisionId, project.organizationId, project.id, item.id, expectedRevision, expectedPublishedRevisionId, expectedPublishedRevisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_revisions
        (id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json,data_snapshot_manifest_json)
       SELECT ?,?,?,?,?,?,?,'published',?,?, '[]',? WHERE changes() = 1`
    ).bind(revisionId, project.organizationId, project.id, item.id, revisionNumber, parent?.id || null, "1", auth.subject, reason, JSON.stringify(lineage)),
    ...blocks.map((block) => env.TOYS_DB.prepare(
      `INSERT INTO content_blocks
        (id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json)
       SELECT ?,?,?,?,?,?,?,'1',? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(crypto.randomUUID(), project.organizationId, project.id, revisionId, block.blockKey, block.position, block.type, JSON.stringify(block.payload), project.organizationId, project.id, revisionId)),
    env.TOYS_DB.prepare(
      `UPDATE content_revisions SET status = 'archived'
        WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id <> ? AND status = 'published'
          AND EXISTS (SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?)`
    ).bind(project.organizationId, project.id, item.id, revisionId, project.organizationId, project.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_publication_events
        (id,organization_id,project_id,content_item_id,event_type,revision_id,previous_revision_id,source_revision_id,actor_ref,reason,idempotency_key)
       SELECT ?,?,?,?,'save_publish',?,?,NULL,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(eventId, project.organizationId, project.id, item.id, revisionId, item.publishedRevisionId, auth.subject, reason, idempotencyKey2, project.organizationId, project.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       SELECT ?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_publication_events WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(project.organizationId, project.id, action, idempotencyKey2, requestHash, JSON.stringify(resultBody), project.organizationId, project.id, eventId)
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.at(-1)?.meta?.changes || 0) !== 1) {
      throw new Error("revision_conflict");
    }
  } catch (_) {
    const current = await contentItem(env, project, logicalKey);
    return response3({ ok: false, error: "revision_conflict", currentRevision: current?.latestRevision ?? null, currentPublishedRevisionId: current?.publishedRevisionId ?? null }, 409);
  }
  const readbackItem = await contentItem(env, project, logicalKey);
  const readback2 = await revisionModel(env, readbackItem, readbackItem.publishedRevisionId);
  return response3({ ...resultBody, readback: readback2 }, 201);
}
__name(saveAndPublishRevision, "saveAndPublishRevision");
async function rollbackRevision(request, env, slug2, logicalKey, sourceRevisionId) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response3({ ok: false, error: "not_found" }, 404);
  const source = await revisionModel(env, item, sourceRevisionId);
  if (!source) return response3({ ok: false, error: "revision_not_found" }, 404);
  const body = await parseBody3(request);
  if (!body) return response3({ ok: false, error: "invalid_json" }, 400);
  const expectedRevision = Number(body.expectedRevision);
  const expectedPublishedRevisionId = body.expectedPublishedRevisionId == null ? null : String(body.expectedPublishedRevisionId);
  const idempotencyKey2 = String(request.headers.get("x-idempotency-key") || body.idempotencyKey || "");
  if (!Number.isInteger(expectedRevision) || idempotencyKey2.length < 8 || idempotencyKey2.length > 200) {
    return response3({ ok: false, error: "invalid_revision_request" }, 400);
  }
  const reason = String(body.reason || `Rollback to revision ${source.revisionNumber}`).trim().slice(0, 500);
  const expectedRelease = expectedDataRelease(body);
  if (!expectedRelease.ok) return response3({ ok: false, error: "invalid_data_release" }, 400);
  const action = `content-rollback:${item.id}`;
  const requestHash = await sha256Text3(JSON.stringify({ sourceRevisionId, expectedRevision, expectedPublishedRevisionId, expectedDataReleaseId: expectedRelease.id, reason }));
  const stored = await storedIdempotency3(env, project, action, idempotencyKey2, requestHash);
  if (stored?.conflict) return response3({ ok: false, error: "idempotency_key_reuse" }, 409);
  if (stored) {
    const readback3 = await revisionModel(env, item, stored.response?.revision?.id);
    return response3({ ...stored.response, readback: readback3 });
  }
  const releaseCheck = await checkedReleaseLineage(env, project, body);
  if (!releaseCheck.ok) return response3({ ok: false, error: releaseCheck.error, currentDataReleaseId: releaseCheck.currentDataReleaseId }, releaseCheck.status);
  if (item.latestRevision !== expectedRevision || (item.publishedRevisionId || null) !== expectedPublishedRevisionId) {
    return response3({
      ok: false,
      error: "revision_conflict",
      expectedRevision,
      currentRevision: item.latestRevision,
      expectedPublishedRevisionId,
      currentPublishedRevisionId: item.publishedRevisionId
    }, 409);
  }
  const lineage = releaseCheck.lineage;
  const parent = await env.TOYS_DB.prepare(
    `SELECT id FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND revision_number = ?`
  ).bind(project.organizationId, project.id, item.id, expectedRevision).first();
  const revisionId = crypto.randomUUID();
  const revisionNumber = expectedRevision + 1;
  const eventId = crypto.randomUUID();
  const resultBody = {
    ok: true,
    revision: { id: revisionId, revisionNumber, parentRevisionId: parent?.id || null, status: "published" },
    rollbackSourceRevisionId: sourceRevisionId,
    previousPublishedRevisionId: item.publishedRevisionId
  };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items
          SET latest_revision_number = ?, published_revision_id = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ? AND latest_revision_number = ?
          AND ((published_revision_id = ?) OR (published_revision_id IS NULL AND ? IS NULL))`
    ).bind(revisionNumber, revisionId, project.organizationId, project.id, item.id, expectedRevision, expectedPublishedRevisionId, expectedPublishedRevisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_revisions
        (id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json,data_snapshot_manifest_json)
       SELECT ?,?,?,?,?,?,?,'published',?,?,?,? WHERE changes() = 1`
    ).bind(
      revisionId,
      project.organizationId,
      project.id,
      item.id,
      revisionNumber,
      parent?.id || null,
      "1",
      auth.subject,
      reason,
      JSON.stringify([{ kind: "rollback_source", revisionId: sourceRevisionId }]),
      JSON.stringify(lineage)
    ),
    ...source.blocks.map((block) => env.TOYS_DB.prepare(
      `INSERT INTO content_blocks
        (id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json)
       SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(
      crypto.randomUUID(),
      project.organizationId,
      project.id,
      revisionId,
      block.blockKey,
      block.position,
      block.type,
      block.payloadSchemaVersion || "1",
      JSON.stringify(block.payload),
      project.organizationId,
      project.id,
      revisionId
    )),
    env.TOYS_DB.prepare(
      `UPDATE content_revisions SET status = 'archived'
        WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id <> ? AND status = 'published'
          AND EXISTS (SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?)`
    ).bind(project.organizationId, project.id, item.id, revisionId, project.organizationId, project.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_publication_events
        (id,organization_id,project_id,content_item_id,event_type,revision_id,previous_revision_id,source_revision_id,actor_ref,reason,idempotency_key)
       SELECT ?,?,?,?,'rollback',?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(
      eventId,
      project.organizationId,
      project.id,
      item.id,
      revisionId,
      item.publishedRevisionId,
      sourceRevisionId,
      auth.subject,
      reason,
      idempotencyKey2,
      project.organizationId,
      project.id,
      revisionId
    ),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       SELECT ?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_publication_events WHERE organization_id = ? AND project_id = ? AND id = ?
       )`
    ).bind(project.organizationId, project.id, action, idempotencyKey2, requestHash, JSON.stringify(resultBody), project.organizationId, project.id, eventId)
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.at(-1)?.meta?.changes || 0) !== 1) {
      throw new Error("revision_conflict");
    }
  } catch (_) {
    const current = await contentItem(env, project, logicalKey);
    return response3({ ok: false, error: "revision_conflict", currentRevision: current?.latestRevision ?? null, currentPublishedRevisionId: current?.publishedRevisionId ?? null }, 409);
  }
  const readbackItem = await contentItem(env, project, logicalKey);
  const readback2 = await revisionModel(env, readbackItem, readbackItem.publishedRevisionId);
  return response3({ ...resultBody, readback: readback2 }, 201);
}
__name(rollbackRevision, "rollbackRevision");
async function ownerEditor(request, env, slug2) {
  const auth = await authorizeMvp(request, env, slug2, "editor");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  return protectedHtmlAsset(request, env, slug2, "/assets/weekly-reports-editor.html", {
    unavailable: "editor_asset_unavailable",
    basePath: `/${slug2}/`
  });
}
__name(ownerEditor, "ownerEditor");
async function projectPortal(request, env, slug2) {
  const auth = await authorizeMvp(request, env, slug2, "viewer");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const portal = PROJECT_PORTAL_ASSETS.get(slug2);
  if (!portal) return response3({ ok: false, error: "project_scope_forbidden" }, 403);
  return protectedHtmlAsset(request, env, slug2, portal.assetPath, {
    unavailable: "project_portal_asset_unavailable",
    projectPortal: true,
    basePath: portal.basePath
  });
}
__name(projectPortal, "projectPortal");
async function protectedHtmlAsset(request, env, slug2, assetPath, options = {}) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return response3({ ok: false, error: options.unavailable || "asset_unavailable" }, 503);
  }
  const assetUrl = new URL(assetPath, request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!asset.ok) return response3({ ok: false, error: options.unavailable || "asset_unavailable" }, 503);
  const html = await asset.text();
  const apiBase = `/api/v2/projects/${slug2}`;
  const bootstrap = `<script>window.TOYS_MVP_API_BASE=${JSON.stringify(apiBase)};window.TOYS_MVP_WORKSPACE_API_BASE=${JSON.stringify(`${apiBase}/content-project`)};window.TOYS_MVP_EDITOR_URL=${JSON.stringify(`${apiBase}/content-editor`)};window.TOYS_MVP_PROJECT_URL=${JSON.stringify(`${apiBase}/content-project`)};window.TOYS_MVP_PROJECT_PORTAL=${options.projectPortal === true};<\/script>`;
  const base = options.basePath ? `<base href=${JSON.stringify(new URL(options.basePath, request.url).href)}>` : "";
  const headers = new Headers(asset.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-frame-options", "DENY");
  headers.delete("content-length");
  headers.delete("etag");
  const withBase = base ? html.replace("<head>", `<head>
${base}`) : html;
  return new Response(withBase.replace("</head>", `${bootstrap}
</head>`), { status: 200, headers });
}
__name(protectedHtmlAsset, "protectedHtmlAsset");
function emptyGvizTable() {
  return { version: "0.6", status: "ok", table: { cols: [], rows: [] }, meta: { state: "empty" } };
}
__name(emptyGvizTable, "emptyGvizTable");
async function projectTab(request, env, slug2) {
  const publicRead = publicProjectMaterialAllowed(env, slug2);
  const auth = publicRead ? { ok: true, role: "public_viewer" } : await authorizeMvp(request, env, slug2, "viewer");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const url = new URL(request.url);
  const title = String(url.searchParams.get("tab") || "");
  const housevip = project.slug === "housevip-cxp7";
  if (!title) {
    const result = await env.TOYS_DB.prepare(
      `SELECT tab_key AS tabKey, source_title AS sourceTitle, label, channel, mode, position
         FROM project_tabs
        WHERE project_id = ?
        ORDER BY position, source_title`
    ).bind(project.id).all();
    const tabs = (result.results || []).filter((row2) => !housevip || HOUSEVIP_PROJECT_TABS.has(row2.sourceTitle)).map((row2) => ({
      ...!publicRead ? { tabKey: row2.tabKey } : {},
      sourceTitle: row2.sourceTitle,
      label: row2.label,
      channel: row2.channel,
      mode: row2.mode,
      position: row2.position
    }));
    return response3({ ok: true, project: { slug: project.slug }, tabs });
  }
  if (housevip && !HOUSEVIP_PROJECT_TABS.has(title)) {
    return response3({ ok: false, error: "project_tab_forbidden" }, 403);
  }
  const raw = url.searchParams.get("raw") === "1";
  const row = await env.TOYS_DB.prepare(
    `SELECT content_json AS contentJson, raw_content_json AS rawContentJson
       FROM project_tabs
      WHERE project_id = ? AND source_title = ?
      LIMIT 1`
  ).bind(project.id, title).first();
  if (!row) {
    return housevip ? response3(emptyGvizTable()) : response3({ ok: false, error: "project_tab_forbidden" }, 403);
  }
  try {
    const document = JSON.parse(raw && row.rawContentJson ? row.rawContentJson : row.contentJson);
    if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("invalid_project_tab");
    return response3(document);
  } catch (_) {
    return response3({ ok: false, error: "invalid_project_tab_data" }, 500);
  }
}
__name(projectTab, "projectTab");
async function weeklyReports(request, env, slug2) {
  const publicRead = publicProjectMaterialAllowed(env, slug2);
  const auth = publicRead ? { ok: true, role: "public_viewer" } : await authorizeMvp(request, env, slug2, "viewer");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const result = await env.TOYS_DB.prepare(
    `SELECT period_start AS periodStart,period_end AS periodEnd,summary,wins,issues,changes,next_steps AS nextSteps
       FROM weekly_reports
      WHERE project_id = ? AND status = 'published'
      ORDER BY period_end DESC,period_start DESC`
  ).bind(project.id).all();
  return response3({
    ok: true,
    access: { role: auth.role },
    project: { slug: project.slug },
    reports: result.results || []
  });
}
__name(weeklyReports, "weeklyReports");
async function exchangeRate(request, env, slug2) {
  const auth = await authorizeMvp(request, env, slug2, "viewer", "exchange-rate");
  if (!auth.ok) return response3({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug2);
  if (!project) return response3({ ok: false, error: "not_found" }, 404);
  const url = new URL(request.url);
  const base = String(url.searchParams.get("base") || "").toUpperCase();
  const quote = String(url.searchParams.get("quote") || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return response3({ ok: false, error: "invalid_currency" }, 400);
  const rate = await env.TOYS_DB.prepare(
    `SELECT rate_date AS date, base_currency AS base, quote_currency AS quote, rate, source
       FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? ORDER BY rate_date DESC LIMIT 1`
  ).bind(base, quote).first();
  if (!rate) return response3({ ok: false, error: "not_found" }, 404);
  return response3({ ok: true, rate: { ...rate, basis: "latest_reference" } });
}
__name(exchangeRate, "exchangeRate");
async function handleMvpApi(request, env) {
  const url = new URL(request.url);
  const adsHierarchyMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?ads\/hierarchy$/);
  if (request.method === "GET" && adsHierarchyMatch) return adsHierarchy(request, env, adsHierarchyMatch[1], false);
  const adsRefreshMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?ads\/refresh$/);
  if (request.method === "POST" && adsRefreshMatch) return adsHierarchy(request, env, adsRefreshMatch[1], true);
  const creativeCollectionMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?creatives$/);
  if (["GET", "POST"].includes(request.method) && creativeCollectionMatch) {
    return creativeCollection(request, env, creativeCollectionMatch[1]);
  }
  const creativePreviewMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?creatives\/([a-z0-9-]+)\/preview$/);
  if (request.method === "GET" && creativePreviewMatch) {
    return creativeResource(request, env, creativePreviewMatch[1], creativePreviewMatch[2], "preview");
  }
  const creativeUploadMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?creatives\/([a-z0-9-]+)\/upload$/);
  if (request.method === "PUT" && creativeUploadMatch) {
    return creativeResource(request, env, creativeUploadMatch[1], creativeUploadMatch[2], "upload");
  }
  const creativeCommentsMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?creatives\/([a-z0-9-]+)\/comments$/);
  if (["GET", "POST"].includes(request.method) && creativeCommentsMatch) {
    return creativeResource(request, env, creativeCommentsMatch[1], creativeCommentsMatch[2], "comments");
  }
  const creativeStatusMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(?:content-project\/)?creatives\/([a-z0-9-]+)$/);
  if (request.method === "PATCH" && creativeStatusMatch) {
    return creativeResource(request, env, creativeStatusMatch[1], creativeStatusMatch[2], "status");
  }
  const dashboardMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/dashboard$/);
  if (["GET", "HEAD"].includes(request.method) && dashboardMatch) return dashboard(request, env, dashboardMatch[1]);
  const editorMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content-editor$/);
  if (request.method === "GET" && editorMatch) return ownerEditor(request, env, editorMatch[1]);
  const projectPortalMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content-project$/);
  if (request.method === "GET" && projectPortalMatch) return projectPortal(request, env, projectPortalMatch[1]);
  const projectTabMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/tabs$/);
  if (["GET", "HEAD"].includes(request.method) && projectTabMatch) return projectTab(request, env, projectTabMatch[1]);
  const weeklyMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/weekly-reports$/);
  if (["GET", "HEAD"].includes(request.method) && weeklyMatch) return weeklyReports(request, env, weeklyMatch[1]);
  const contentMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content$/);
  if (request.method === "GET" && contentMatch) return publishedContent(request, env, contentMatch[1]);
  const commentsMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/comments$/);
  if (["GET", "POST"].includes(request.method) && commentsMatch) return contentComments(request, env, commentsMatch[1], commentsMatch[2]);
  const historyMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions$/);
  if (request.method === "GET" && historyMatch) return revisionHistory(request, env, historyMatch[1], historyMatch[2]);
  if (request.method === "POST" && historyMatch) return createRevision(request, env, historyMatch[1], historyMatch[2]);
  const savePublishMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/save-and-publish$/);
  if (request.method === "POST" && savePublishMatch) return saveAndPublishRevision(request, env, savePublishMatch[1], savePublishMatch[2]);
  const detailMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions\/([a-z0-9_-]+)$/);
  if (request.method === "GET" && detailMatch) return revisionDetail(request, env, detailMatch[1], detailMatch[2], detailMatch[3]);
  const publishMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions\/([a-z0-9_-]+)\/publish$/);
  if (request.method === "POST" && publishMatch) return publishRevision(request, env, publishMatch[1], publishMatch[2], publishMatch[3]);
  const rollbackMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions\/([a-z0-9_-]+)\/rollback$/);
  if (request.method === "POST" && rollbackMatch) return rollbackRevision(request, env, rollbackMatch[1], rollbackMatch[2], rollbackMatch[3]);
  const rateMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/exchange-rate$/);
  if (["GET", "HEAD"].includes(request.method) && rateMatch) return exchangeRate(request, env, rateMatch[1]);
  return response3({ ok: false, error: "not_found" }, 404);
}
__name(handleMvpApi, "handleMvpApi");

// src/housevip-sync.js
var ORGANIZATION_ID = "org_toys_agency";
var PROJECT_ID = "prj_housevip_cxp7";
var SOURCE_STREAM_ID = "src_housevip_metaads_gviz";
var SOURCE_TIMEZONE = "Asia/Tbilisi";
var SOURCE_SCHEMA_VERSION = "housevip-gviz-metaads/1.0";
var MAPPING_VERSION = "housevip-gviz-metaads/1";
var ADS_BOOK_ID = "1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU";
var METAADS_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${ADS_BOOK_ID}/gviz/tq?tqx=out%3Ajson&sheet=MetaAds`;
var MAX_SOURCE_BYTES = 4e6;
var MAX_SOURCE_ROWS = 2e4;
var MAX_CAMPAIGN_LENGTH = 500;
var MAX_REQUESTED_DAYS = 400;
var METRIC_FIELDS = ["impressions", "clicks", "cost", "conversions", "convValue"];
var METRIC_CODES = {
  impressions: ["ads.impressions", "count", null],
  clicks: ["ads.clicks", "count", null],
  cost: ["ads.spend", "money", "IDR"],
  conversions: ["ads.reported_conversions", "weighted_count", null],
  convValue: ["legacy.conversion_value_unknown", "unknown", "IDR"]
};
var HousevipSyncError = class extends Error {
  static {
    __name(this, "HousevipSyncError");
  }
  constructor(code, message2 = code) {
    super(message2);
    this.name = "HousevipSyncError";
    this.code = code;
  }
};
function fail4(code, message2) {
  throw new HousevipSyncError(code, message2);
}
__name(fail4, "fail");
function validDate2(value2) {
  const text4 = String(value2 || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text4)) return false;
  const parsed = /* @__PURE__ */ new Date(`${text4}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text4;
}
__name(validDate2, "validDate");
function datePlusDays(value2, amount) {
  if (!validDate2(value2)) fail4("invalid_date", `invalid calendar date: ${value2}`);
  const date2 = /* @__PURE__ */ new Date(`${value2}T00:00:00Z`);
  date2.setUTCDate(date2.getUTCDate() + amount);
  return date2.toISOString().slice(0, 10);
}
__name(datePlusDays, "datePlusDays");
function daysBetween(from, toExclusive) {
  return Math.round((Date.parse(`${toExclusive}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}
__name(daysBetween, "daysBetween");
function normalizedAccountId(value2) {
  return String(value2 || "").trim().replace(/^act_/i, "");
}
__name(normalizedAccountId, "normalizedAccountId");
function sourceLocalDate(nowValue) {
  const date2 = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (Number.isNaN(date2.getTime())) fail4("invalid_now", "sync clock returned an invalid date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SOURCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date2);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
__name(sourceLocalDate, "sourceLocalDate");
function canonicalDecimal(value2, field, { integer = false } = {}) {
  const raw = typeof value2 === "number" ? String(value2) : String(value2 ?? "").trim();
  if (!raw || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    fail4("invalid_metric", `${field}: expected a non-negative decimal`);
  }
  if (integer && raw.includes(".")) fail4("invalid_metric", `${field}: expected a non-negative integer`);
  let [whole, fraction = ""] = raw.split(".");
  fraction = fraction.replace(/0+$/, "");
  whole = whole.replace(/^0+(?=\d)/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
__name(canonicalDecimal, "canonicalDecimal");
function decimalParts(value2) {
  const [whole, fraction = ""] = canonicalDecimal(value2, "decimal").split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length };
}
__name(decimalParts, "decimalParts");
function addDecimals(values) {
  const parsed = values.map(decimalParts);
  const scale = parsed.reduce((maximum, item) => Math.max(maximum, item.scale), 0);
  const total = parsed.reduce((sum, item) => sum + item.integer * 10n ** BigInt(scale - item.scale), 0n);
  const digits2 = total.toString().padStart(scale + 1, "0");
  if (!scale) return digits2;
  return canonicalDecimal(`${digits2.slice(0, -scale)}.${digits2.slice(-scale)}`, "decimal");
}
__name(addDecimals, "addDecimals");
function cellValue(cell) {
  if (!cell) return "";
  return cell.v ?? cell.f ?? "";
}
__name(cellValue, "cellValue");
function gvizDate(cell, field) {
  const raw = cellValue(cell);
  const formatted = String(cell?.f ?? "").trim();
  const candidates = [raw, formatted];
  for (const candidate of candidates) {
    const text4 = String(candidate ?? "").trim();
    const gviz2 = text4.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
    if (gviz2) {
      const value2 = `${gviz2[1]}-${String(Number(gviz2[2]) + 1).padStart(2, "0")}-${gviz2[3].padStart(2, "0")}`;
      if (validDate2(value2)) return value2;
    }
    const iso = text4.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (iso && validDate2(iso)) return iso;
    const local = text4.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (local) {
      const value2 = `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
      if (validDate2(value2)) return value2;
    }
  }
  fail4("invalid_date", `${field}: invalid calendar date`);
}
__name(gvizDate, "gvizDate");
function normalizedLabel(column) {
  return String(column?.label || column?.id || "").trim().toLowerCase();
}
__name(normalizedLabel, "normalizedLabel");
function parseEnvelope(text4) {
  const start = text4.indexOf("{");
  const end = text4.lastIndexOf("}");
  if (start < 0 || end < start) fail4("invalid_gviz", "MetaAds: invalid GViz response");
  try {
    return JSON.parse(text4.slice(start, end + 1));
  } catch (_) {
    fail4("invalid_gviz", "MetaAds: invalid GViz JSON");
  }
}
__name(parseEnvelope, "parseEnvelope");
function parseGvizMetaAds(text4, { expectedAccountId = null } = {}) {
  const payload = parseEnvelope(String(text4 || ""));
  if (payload.status === "error") fail4("source_error", "MetaAds: GViz returned an error");
  const table3 = payload.table;
  if (!table3 || !Array.isArray(table3.cols) || !Array.isArray(table3.rows)) {
    fail4("schema_mismatch", "MetaAds: missing GViz table");
  }
  if (table3.rows.length > MAX_SOURCE_ROWS) fail4("source_too_large", "MetaAds: row limit exceeded");
  const expected = ["date", "platform", "account_name", "account_id", "currency", "campaign", "impressions", "clicks", "cost", "conversions", "conv_value"];
  const actual = table3.cols.slice(0, expected.length).map(normalizedLabel);
  if (expected.some((label, index) => actual[index] !== label)) {
    fail4("schema_mismatch", "MetaAds: unexpected column schema");
  }
  const safeRows = [];
  table3.rows.forEach((record, index) => {
    const cells = Array.isArray(record?.c) ? record.c : [];
    if (!cells.some((cell) => String(cellValue(cell)).trim())) return;
    const date2 = gvizDate(cells[0], `MetaAds row ${index + 2}`);
    const platform = String(cellValue(cells[1])).trim();
    const accountId2 = normalizedAccountId(cellValue(cells[3]));
    const currency3 = String(cellValue(cells[4])).trim();
    const campaign = String(cellValue(cells[5])).trim();
    if (platform !== "Meta Ads") fail4("source_mismatch", `MetaAds row ${index + 2}: unexpected platform`);
    if (currency3 !== "IDR") fail4("source_mismatch", `MetaAds row ${index + 2}: unexpected currency`);
    if (expectedAccountId && accountId2 !== normalizedAccountId(expectedAccountId)) {
      fail4("source_account_mismatch", `MetaAds row ${index + 2}: unexpected account`);
    }
    if (!campaign) fail4("schema_mismatch", `MetaAds row ${index + 2}: campaign is required`);
    if (campaign.length > MAX_CAMPAIGN_LENGTH) fail4("source_too_large", `MetaAds row ${index + 2}: campaign label is too long`);
    safeRows.push({
      date: date2,
      platform: "Meta Ads",
      currency: "IDR",
      campaign,
      impressions: canonicalDecimal(cellValue(cells[6]), `MetaAds row ${index + 2}.impressions`, { integer: true }),
      clicks: canonicalDecimal(cellValue(cells[7]), `MetaAds row ${index + 2}.clicks`, { integer: true }),
      cost: canonicalDecimal(cellValue(cells[8]), `MetaAds row ${index + 2}.cost`),
      conversions: canonicalDecimal(cellValue(cells[9]), `MetaAds row ${index + 2}.conversions`),
      convValue: canonicalDecimal(cellValue(cells[10]), `MetaAds row ${index + 2}.conv_value`)
    });
  });
  if (!safeRows.length) fail4("empty_source", "MetaAds contains no advertising rows");
  return safeRows;
}
__name(parseGvizMetaAds, "parseGvizMetaAds");
function rowSort(a, b) {
  return a.date.localeCompare(b.date) || a.campaign.localeCompare(b.campaign) || a.currency.localeCompare(b.currency);
}
__name(rowSort, "rowSort");
function normalizeMetaAdsRows(rows, { requestedFrom, requestedToExclusive } = {}) {
  if (!Array.isArray(rows) || !rows.length) fail4("empty_source", "MetaAds contains no advertising rows");
  const grouped = /* @__PURE__ */ new Map();
  for (const [index, input] of rows.entries()) {
    if (!validDate2(input?.date)) fail4("invalid_date", `row ${index}: invalid calendar date`);
    if (input.platform !== "Meta Ads" || input.currency !== "IDR") fail4("source_mismatch", `row ${index}: unexpected source`);
    const campaign = String(input.campaign || "").trim();
    if (!campaign) fail4("schema_mismatch", `row ${index}: campaign is required`);
    const key = `${input.date}${campaign}IDR`;
    const metrics = {
      impressions: canonicalDecimal(input.impressions, `row ${index}.impressions`, { integer: true }),
      clicks: canonicalDecimal(input.clicks, `row ${index}.clicks`, { integer: true }),
      cost: canonicalDecimal(input.cost, `row ${index}.cost`),
      conversions: canonicalDecimal(input.conversions, `row ${index}.conversions`),
      convValue: canonicalDecimal(input.convValue, `row ${index}.convValue`)
    };
    const current = grouped.get(key);
    grouped.set(key, current ? {
      ...current,
      ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, addDecimals([current[field], metrics[field]])]))
    } : { date: input.date, platform: "Meta Ads", currency: "IDR", campaign, ...metrics });
  }
  const normalized = [...grouped.values()].sort(rowSort);
  const observedFrom = normalized[0].date;
  const observedToExclusive = datePlusDays(normalized.at(-1).date, 1);
  const from = requestedFrom || observedFrom;
  const toExclusive = requestedToExclusive || observedToExclusive;
  if (!validDate2(from) || !validDate2(toExclusive) || from >= toExclusive) fail4("invalid_range", "invalid requested range");
  if (daysBetween(from, toExclusive) > MAX_REQUESTED_DAYS) fail4("range_too_large", "requested range is too large");
  if (observedFrom < from || observedToExclusive > toExclusive) fail4("range_mismatch", "source row falls outside requested range");
  return normalized;
}
__name(normalizeMetaAdsRows, "normalizeMetaAdsRows");
function detectMissingDateRanges(rows, requestedFrom, requestedToExclusive) {
  if (!validDate2(requestedFrom) || !validDate2(requestedToExclusive) || requestedFrom >= requestedToExclusive) {
    fail4("invalid_range", "invalid requested range");
  }
  const present = new Set(rows.map((row) => row.date));
  const missing = [];
  let rangeStart = null;
  for (let date2 = requestedFrom; date2 < requestedToExclusive; date2 = datePlusDays(date2, 1)) {
    if (!present.has(date2) && rangeStart === null) rangeStart = date2;
    if (present.has(date2) && rangeStart !== null) {
      missing.push({ from: rangeStart, toExclusive: date2, state: "missing" });
      rangeStart = null;
    }
  }
  if (rangeStart !== null) missing.push({ from: rangeStart, toExclusive: requestedToExclusive, state: "missing" });
  return missing;
}
__name(detectMissingDateRanges, "detectMissingDateRanges");
function canonicalizeMetaAdsRows(rows) {
  return JSON.stringify(rows.map((row) => ({
    date: row.date,
    platform: row.platform,
    currency: row.currency,
    campaign: row.campaign,
    impressions: row.impressions,
    clicks: row.clicks,
    cost: row.cost,
    conversions: row.conversions,
    convValue: row.convValue
  })).sort(rowSort));
}
__name(canonicalizeMetaAdsRows, "canonicalizeMetaAdsRows");
async function sha256(value2) {
  const bytes = new TextEncoder().encode(String(value2));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
async function semanticContentHash(rows, { requestedFrom = null, requestedToExclusive = null } = {}) {
  const normalized = normalizeMetaAdsRows(rows);
  const range = requestedFrom && requestedToExclusive ? `${requestedFrom}${requestedToExclusive}` : "";
  return sha256(`${SOURCE_SCHEMA_VERSION}${MAPPING_VERSION}${range}${canonicalizeMetaAdsRows(normalized)}`);
}
__name(semanticContentHash, "semanticContentHash");
function totalsForRows(rows) {
  return Object.fromEntries(METRIC_FIELDS.map((field) => [field, addDecimals(rows.map((row) => row[field]))]));
}
__name(totalsForRows, "totalsForRows");
function scaleOf(value2) {
  return String(value2).split(".")[1]?.length || 0;
}
__name(scaleOf, "scaleOf");
function nowIso2(now) {
  const value2 = typeof now === "function" ? now() : now ?? /* @__PURE__ */ new Date();
  const date2 = value2 instanceof Date ? value2 : new Date(value2);
  if (Number.isNaN(date2.getTime())) fail4("invalid_now", "sync clock returned an invalid date");
  return date2.toISOString();
}
__name(nowIso2, "nowIso");
async function first3(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).first();
}
__name(first3, "first");
async function all2(db, sql, ...bindings) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result?.results || [];
}
__name(all2, "all");
async function run3(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).run();
}
__name(run3, "run");
async function batchChunks(db, statements, size = 60) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}
__name(batchChunks, "batchChunks");
function statement(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings);
}
__name(statement, "statement");
async function startRun(db, startedAt) {
  const result = await run3(
    db,
    `INSERT INTO sync_runs (project_id,provider,job_type,status,started_at,rows_read,rows_written,message,details_json)
     VALUES (?,'google_sheets','housevip-metaads-gviz','running',?,0,0,'HOUSEVIP MetaAds sync started','{}')`,
    PROJECT_ID,
    startedAt
  );
  const id = Number(result?.meta?.last_row_id || 0);
  if (id) return id;
  const row = await first3(
    db,
    `SELECT id FROM sync_runs WHERE project_id=? AND provider='google_sheets' AND job_type='housevip-metaads-gviz' AND started_at=? ORDER BY id DESC LIMIT 1`,
    PROJECT_ID,
    startedAt
  );
  return Number(row?.id || 0);
}
__name(startRun, "startRun");
async function finishRun(db, runId, status, finishedAt, { rowsRead = 0, rowsWritten = 0, message: message2, details = {} } = {}) {
  if (!runId) return;
  await run3(
    db,
    `UPDATE sync_runs SET status=?,finished_at=?,rows_read=?,rows_written=?,message=?,details_json=? WHERE id=?`,
    status,
    finishedAt,
    rowsRead,
    rowsWritten,
    String(message2 || status).slice(0, 500),
    JSON.stringify(details),
    runId
  );
}
__name(finishRun, "finishRun");
async function updateIntegration(db, status, at, success) {
  await run3(
    db,
    `UPDATE integrations SET status=?,last_success_at=CASE WHEN ? THEN ? ELSE last_success_at END,updated_at=? WHERE id='int_housevip_meta'`,
    status,
    success ? 1 : 0,
    at,
    at
  );
}
__name(updateIntegration, "updateIntegration");
async function fetchMetaAds(fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response5 = await fetchImpl(METAADS_GVIZ_URL, {
      method: "GET",
      headers: { accept: "application/json,text/plain;q=0.9" },
      signal: controller.signal
    });
    if (!response5?.ok) fail4("http_error", `MetaAds source HTTP ${response5?.status || "error"}`);
    const declaredLength = Number(response5.headers?.get?.("content-length") || 0);
    if (declaredLength > MAX_SOURCE_BYTES) fail4("source_too_large", "MetaAds source response is too large");
    const text4 = await response5.text();
    if (new TextEncoder().encode(text4).byteLength > MAX_SOURCE_BYTES) {
      fail4("source_too_large", "MetaAds source response is too large");
    }
    return text4;
  } catch (error) {
    if (error instanceof HousevipSyncError) throw error;
    if (controller.signal.aborted) fail4("source_timeout", "MetaAds source request timed out");
    fail4("source_unavailable", "MetaAds source request failed");
  } finally {
    clearTimeout(timeout);
  }
}
__name(fetchMetaAds, "fetchMetaAds");
function observationKey(row) {
  return `${row.date}${row.campaign}${row.currency}`;
}
__name(observationKey, "observationKey");
async function buildFactStatements(db, rows, generationId, sourceHash) {
  const statements = [];
  for (const row of rows) {
    const key = observationKey(row);
    const keyHash = await sha256(key);
    const observationId = `obs_${(await sha256(`${generationId}${key}`)).slice(0, 28)}`;
    const rowHash = await sha256(JSON.stringify(row));
    statements.push(statement(
      db,
      `INSERT OR IGNORE INTO fact_observations
       (id,organization_id,project_id,generation_id,source_stream_id,observation_key,local_date,source_timezone,reporting_date_basis,grain,account_ref,provider_campaign_id,legacy_group_ref,legacy_campaign_label,source_record_ref,source_hash)
       VALUES (?,?,?,?,?,?,?,?,'source_local_date','campaign_daily',NULL,NULL,?,?,?,?)`,
      observationId,
      ORGANIZATION_ID,
      PROJECT_ID,
      generationId,
      SOURCE_STREAM_ID,
      key,
      row.date,
      SOURCE_TIMEZONE,
      `legacy_group_${keyHash.slice(0, 24)}`,
      row.campaign,
      `MetaAds:${keyHash.slice(0, 24)}`,
      rowHash
    ));
    for (const field of METRIC_FIELDS) {
      const [code, unit, fixedCurrency] = METRIC_CODES[field];
      statements.push(statement(
        db,
        `INSERT OR IGNORE INTO fact_values
         (organization_id,project_id,observation_id,metric_code,metric_version,value_basis,value_text,scale,unit,currency,value_state,quality_flags_json,origin_refs_json)
         VALUES (?,?,?,?,'1','source_native',?,?,?,?, 'observed',?,'[]')`,
        ORGANIZATION_ID,
        PROJECT_ID,
        observationId,
        code,
        row[field],
        scaleOf(row[field]),
        unit,
        fixedCurrency,
        code === "legacy.conversion_value_unknown" ? '["unclassified_semantics"]' : "[]"
      ));
    }
  }
  return statements;
}
__name(buildFactStatements, "buildFactStatements");
function rowsFromReadback(records) {
  const grouped = /* @__PURE__ */ new Map();
  let valid = true;
  for (const record of records) {
    const descriptorEntry = Object.entries(METRIC_CODES).find(([, descriptor2]) => descriptor2[0] === record.metricCode);
    if (!descriptorEntry) {
      valid = false;
      continue;
    }
    const [field, descriptor] = descriptorEntry;
    const expectedQuality = field === "convValue" ? '["unclassified_semantics"]' : "[]";
    if (record.sourceStreamId !== SOURCE_STREAM_ID || record.sourceTimezone !== SOURCE_TIMEZONE || record.reportingDateBasis !== "source_local_date" || record.grain !== "campaign_daily" || record.metricVersion !== "1" || record.valueBasis !== "source_native" || record.valueState !== "observed" || record.unit !== descriptor[1] || (record.currency || null) !== descriptor[2] || record.qualityFlagsJson !== expectedQuality || record.originRefsJson !== "[]" || Number(record.scale) !== scaleOf(record.valueText)) {
      valid = false;
    }
    if (!grouped.has(record.observationKey)) {
      grouped.set(record.observationKey, {
        date: record.localDate,
        platform: "Meta Ads",
        currency: "IDR",
        campaign: record.campaign
      });
    }
    if (grouped.get(record.observationKey)[field] !== void 0) {
      valid = false;
      continue;
    }
    grouped.get(record.observationKey)[field] = canonicalDecimal(record.valueText, record.metricCode, {
      integer: field === "impressions" || field === "clicks"
    });
  }
  return { rows: [...grouped.values()].sort(rowSort), valid };
}
__name(rowsFromReadback, "rowsFromReadback");
async function reconcileGeneration(db, generationId, expectedRows) {
  const records = await all2(
    db,
    `SELECT o.observation_key AS observationKey,o.local_date AS localDate,o.legacy_campaign_label AS campaign,
            o.source_stream_id AS sourceStreamId,o.source_timezone AS sourceTimezone,
            o.reporting_date_basis AS reportingDateBasis,o.grain,o.source_hash AS observationSourceHash,
            v.metric_code AS metricCode,v.metric_version AS metricVersion,v.value_basis AS valueBasis,
            v.value_text AS valueText,v.scale,v.unit,v.currency,v.value_state AS valueState,
            v.quality_flags_json AS qualityFlagsJson,v.origin_refs_json AS originRefsJson
       FROM fact_observations o JOIN fact_values v ON v.observation_id=o.id
      WHERE o.organization_id=? AND o.project_id=? AND o.generation_id=?
      ORDER BY o.local_date,o.observation_key,v.metric_code`,
    ORGANIZATION_ID,
    PROJECT_ID,
    generationId
  );
  const readback2 = rowsFromReadback(records);
  const actualRows = readback2.rows;
  const expectedMin = expectedRows[0]?.date || null;
  const expectedMax = expectedRows.at(-1)?.date || null;
  const actualMin = actualRows[0]?.date || null;
  const actualMax = actualRows.at(-1)?.date || null;
  const expectedTotals = totalsForRows(expectedRows);
  const actualTotals = actualRows.length && actualRows.every((row) => METRIC_FIELDS.every((field) => row[field] !== void 0)) ? totalsForRows(actualRows) : null;
  const expectedSourceHashes = /* @__PURE__ */ new Map();
  for (const row of expectedRows) expectedSourceHashes.set(observationKey(row), await sha256(JSON.stringify(row)));
  const sourceHashesMatch = records.every((record) => record.observationSourceHash === expectedSourceHashes.get(record.observationKey));
  const ok = readback2.valid && sourceHashesMatch && actualRows.length === expectedRows.length && records.length === expectedRows.length * METRIC_FIELDS.length && actualMin === expectedMin && actualMax === expectedMax && actualTotals !== null && JSON.stringify(actualTotals) === JSON.stringify(expectedTotals) && canonicalizeMetaAdsRows(actualRows) === canonicalizeMetaAdsRows(expectedRows);
  return {
    ok,
    expected: { observations: expectedRows.length, facts: expectedRows.length * METRIC_FIELDS.length, minDate: expectedMin, maxDate: expectedMax, totals: expectedTotals },
    actual: { observations: actualRows.length, facts: records.length, minDate: actualMin, maxDate: actualMax, totals: actualTotals, contractValid: readback2.valid, sourceHashesMatch }
  };
}
__name(reconcileGeneration, "reconcileGeneration");
async function quarantine(db, generationId, at, reason, reconciliation) {
  await run3(
    db,
    `UPDATE data_generations SET status='quarantined',availability='error',freshness='stale',sealed_at=?,details_json=?
      WHERE organization_id=? AND project_id=? AND id=? AND status='staging'`,
    at,
    JSON.stringify({ reason, reconciliation }),
    ORGANIZATION_ID,
    PROJECT_ID,
    generationId
  );
}
__name(quarantine, "quarantine");
async function syncHousevip(env, { fetchImpl = fetch, now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now"), timeoutMs = 15e3 } = {}) {
  const db = env?.TOYS_DB;
  if (!db?.prepare || !db?.batch) fail4("database_unavailable", "TOYS_DB binding is required");
  if (typeof fetchImpl !== "function") fail4("fetch_unavailable", "fetch implementation is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail4("invalid_timeout", "timeoutMs must be positive");
  const startedAt = nowIso2(now);
  const project = await first3(db, `SELECT id,organization_id AS organizationId FROM projects WHERE id=? AND status='active'`, PROJECT_ID);
  if (!project || project.organizationId !== ORGANIZATION_ID) fail4("project_unavailable", "active HOUSEVIP project is unavailable");
  const runId = await startRun(db, startedAt);
  let rowsRead = 0;
  let generationId = null;
  try {
    const integration = await first3(
      db,
      `SELECT sync_from_date AS syncFromDate,external_account_id AS externalAccountId FROM integrations WHERE id='int_housevip_meta'`
    );
    if (!normalizedAccountId(integration?.externalAccountId)) {
      fail4("source_account_not_configured", "HOUSEVIP expected Meta account is not configured");
    }
    const sourceText2 = await fetchMetaAds(fetchImpl, timeoutMs);
    const parsedRows = parseGvizMetaAds(sourceText2, { expectedAccountId: integration.externalAccountId });
    rowsRead = parsedRows.length;
    const today = sourceLocalDate(startedAt);
    const parsedMin = [...parsedRows].map((row) => row.date).sort()[0];
    const configuredFrom = validDate2(integration?.syncFromDate) ? integration.syncFromDate : parsedMin;
    const requestedFrom = configuredFrom < parsedMin ? configuredFrom : parsedMin;
    const requestedToExclusive = datePlusDays(today, 1);
    const rows = normalizeMetaAdsRows(parsedRows, { requestedFrom, requestedToExclusive });
    const sourceHash = await semanticContentHash(rows, { requestedFrom, requestedToExclusive });
    generationId = `gen_housevip_gviz_${sourceHash.slice(0, 24)}`;
    const releaseId = `rel_housevip_gviz_${sourceHash.slice(0, 24)}`;
    const idempotencyKey2 = await sha256(`${SOURCE_STREAM_ID}${sourceHash}${MAPPING_VERSION}`);
    const observedFrom = rows[0].date;
    const observedToExclusive = datePlusDays(rows.at(-1).date, 1);
    const missingRanges2 = detectMissingDateRanges(rows, requestedFrom, requestedToExclusive);
    const coverage = missingRanges2.length ? "partial" : "complete";
    const freshness = datePlusDays(rows.at(-1).date, 2) < today ? "stale" : "fresh";
    const current = await first3(
      db,
      `SELECT p.release_id AS releaseId,p.pointer_revision AS pointerRevision,r.source_hash AS sourceHash,
              r.manifest_json AS manifestJson
         FROM project_data_release_pointers p JOIN project_data_releases r ON r.id=p.release_id
        WHERE p.organization_id=? AND p.project_id=?`,
      ORGANIZATION_ID,
      PROJECT_ID
    );
    const expectedPointerRevision = Number(current?.pointerRevision || 0);
    if (current?.sourceHash === sourceHash) {
      let currentGenerationId = null;
      try {
        currentGenerationId = JSON.parse(current.manifestJson || "{}")?.datasets?.[0]?.generationId || null;
      } catch (_) {
        fail4("active_release_invalid", "HOUSEVIP active release manifest is invalid");
      }
      const activeGeneration = currentGenerationId && await first3(
        db,
        `SELECT status FROM data_generations WHERE organization_id=? AND project_id=? AND id=?`,
        ORGANIZATION_ID,
        PROJECT_ID,
        currentGenerationId
      );
      if (activeGeneration?.status !== "sealed") {
        fail4("active_release_invalid", "HOUSEVIP active release generation is not sealed");
      }
      const reconciliation2 = await reconcileGeneration(db, currentGenerationId, rows);
      if (!reconciliation2.ok) {
        fail4("active_release_reconciliation_mismatch", "HOUSEVIP active release readback reconciliation failed");
      }
      await finishRun(db, runId, "success", nowIso2(now), {
        rowsRead,
        rowsWritten: 0,
        message: "HOUSEVIP MetaAds release already current",
        details: { status: "already_current", sourceHash, releaseId: current.releaseId, pointerRevision: expectedPointerRevision, reconciliation: reconciliation2 }
      });
      await updateIntegration(db, "active", nowIso2(now), true);
      return { ok: true, status: "already_current", sourceHash, releaseId: current.releaseId, pointerRevision: expectedPointerRevision, missingRanges: missingRanges2, reconciliation: reconciliation2 };
    }
    await run3(
      db,
      `INSERT INTO source_streams
       (id,organization_id,project_id,channel_key,delivery_provider,business_provider,stable_source_ref,provider_account_ref,source_timezone,grain,source_schema_version,mapping_version,capabilities_json)
       VALUES (?,?,?,'meta','public_gviz','meta_ads','MetaAds:gviz-mirror',NULL,?,'campaign_daily',?,?,?)
       ON CONFLICT(organization_id,project_id,stable_source_ref) DO UPDATE SET
         delivery_provider=excluded.delivery_provider,source_timezone=excluded.source_timezone,
         source_schema_version=excluded.source_schema_version,mapping_version=excluded.mapping_version`,
      SOURCE_STREAM_ID,
      ORGANIZATION_ID,
      PROJECT_ID,
      SOURCE_TIMEZONE,
      SOURCE_SCHEMA_VERSION,
      MAPPING_VERSION,
      '["campaign_daily","reported_conversions"]'
    );
    let existingGeneration = await first3(
      db,
      `SELECT status FROM data_generations WHERE organization_id=? AND project_id=? AND id=?`,
      ORGANIZATION_ID,
      PROJECT_ID,
      generationId
    );
    if (existingGeneration && ["failed", "quarantined"].includes(existingGeneration.status)) {
      const attempts = await first3(
        db,
        `SELECT COUNT(*) AS count FROM data_generations WHERE organization_id=? AND project_id=? AND source_hash=?`,
        ORGANIZATION_ID,
        PROJECT_ID,
        sourceHash
      );
      const attempt = Number(attempts?.count || 1) + 1;
      generationId = `gen_housevip_gviz_${sourceHash.slice(0, 18)}_retry_${attempt}`;
      existingGeneration = await first3(
        db,
        `SELECT status FROM data_generations WHERE organization_id=? AND project_id=? AND id=?`,
        ORGANIZATION_ID,
        PROJECT_ID,
        generationId
      );
    }
    if (existingGeneration && !["staging", "sealed"].includes(existingGeneration.status)) {
      fail4("generation_blocked", `existing generation is ${existingGeneration.status}`);
    }
    if (!existingGeneration) {
      const generationIdempotencyKey = await sha256(`${idempotencyKey2}${generationId}`);
      await run3(
        db,
        `INSERT INTO data_generations
         (id,organization_id,project_id,source_stream_id,idempotency_key,source_hash,status,availability,coverage,freshness,requested_from,requested_to_exclusive,observed_from,observed_to_exclusive,row_count,missing_ranges_json,generated_at,sealed_at,details_json)
         VALUES (?,?,?,?,?,?,'staging','ok',?,?,?,?,?,?,?,?,?,NULL,?)`,
        generationId,
        ORGANIZATION_ID,
        PROJECT_ID,
        SOURCE_STREAM_ID,
        generationIdempotencyKey,
        sourceHash,
        coverage,
        freshness,
        requestedFrom,
        requestedToExclusive,
        observedFrom,
        observedToExclusive,
        rows.length,
        JSON.stringify(missingRanges2),
        startedAt,
        JSON.stringify({ source: "public_gviz", sheet: "MetaAds", accountDataIncluded: false, personalDataIncluded: false })
      );
    }
    await batchChunks(db, await buildFactStatements(db, rows, generationId, sourceHash));
    const reconciliation = await reconcileGeneration(db, generationId, rows);
    if (!reconciliation.ok) {
      const failedAt = nowIso2(now);
      await quarantine(db, generationId, failedAt, "readback_reconciliation_mismatch", reconciliation);
      await finishRun(db, runId, "error", failedAt, {
        rowsRead,
        rowsWritten: 0,
        message: "HOUSEVIP MetaAds readback reconciliation failed",
        details: { code: "reconciliation_mismatch", sourceHash, generationId, reconciliation }
      });
      await updateIntegration(db, "error", failedAt, false);
      fail4("reconciliation_mismatch", "HOUSEVIP MetaAds readback reconciliation failed");
    }
    const manifest = {
      datasets: [{ sourceStreamId: SOURCE_STREAM_ID, generationId, coverage, grain: "campaign_daily" }],
      sourceHash,
      requestedRange: { from: requestedFrom, toExclusive: requestedToExclusive }
    };
    await db.batch([
      statement(
        db,
        `UPDATE data_generations SET status='sealed',availability='ok',sealed_at=?
          WHERE organization_id=? AND project_id=? AND id=? AND status IN ('staging','sealed')`,
        startedAt,
        ORGANIZATION_ID,
        PROJECT_ID,
        generationId
      ),
      statement(
        db,
        `INSERT OR IGNORE INTO project_data_releases
         (id,organization_id,project_id,revision,status,manifest_json,source_hash,created_at)
         SELECT ?,?,?,COALESCE(MAX(revision),0)+1,'sealed',?,?,? FROM project_data_releases
          WHERE organization_id=? AND project_id=?`,
        releaseId,
        ORGANIZATION_ID,
        PROJECT_ID,
        JSON.stringify(manifest),
        sourceHash,
        startedAt,
        ORGANIZATION_ID,
        PROJECT_ID
      ),
      statement(
        db,
        `INSERT OR IGNORE INTO project_data_release_pointers
          (organization_id,project_id,release_id,pointer_revision,updated_at)
         SELECT ?,?,?,1,? WHERE ?=0 AND NOT EXISTS
           (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=?)`,
        ORGANIZATION_ID,
        PROJECT_ID,
        releaseId,
        startedAt,
        expectedPointerRevision,
        ORGANIZATION_ID,
        PROJECT_ID
      ),
      statement(
        db,
        `UPDATE project_data_release_pointers
            SET release_id=?,pointer_revision=pointer_revision+1,updated_at=?
          WHERE organization_id=? AND project_id=? AND pointer_revision=? AND release_id<>?`,
        releaseId,
        startedAt,
        ORGANIZATION_ID,
        PROJECT_ID,
        expectedPointerRevision,
        releaseId
      )
    ]);
    const after = await first3(
      db,
      `SELECT release_id AS releaseId,pointer_revision AS pointerRevision FROM project_data_release_pointers
        WHERE organization_id=? AND project_id=?`,
      ORGANIZATION_ID,
      PROJECT_ID
    );
    if (after?.releaseId !== releaseId) {
      const failedAt = nowIso2(now);
      await finishRun(db, runId, "error", failedAt, {
        rowsRead,
        rowsWritten: rows.length,
        message: "HOUSEVIP MetaAds publication CAS conflict",
        details: { code: "cas_conflict", sourceHash, generationId, releaseId, expectedPointerRevision, currentReleaseId: after?.releaseId || null }
      });
      await updateIntegration(db, "error", failedAt, false);
      fail4("cas_conflict", "HOUSEVIP MetaAds publication CAS conflict");
    }
    const finishedAt = nowIso2(now);
    await finishRun(db, runId, "success", finishedAt, {
      rowsRead,
      rowsWritten: rows.length,
      message: "HOUSEVIP MetaAds release published",
      details: { status: "published", sourceHash, generationId, releaseId, pointerRevision: Number(after.pointerRevision), reconciliation }
    });
    await updateIntegration(db, "active", finishedAt, true);
    return {
      ok: true,
      status: "published",
      sourceHash,
      generationId,
      releaseId,
      pointerRevision: Number(after.pointerRevision),
      rows: rows.length,
      coverage,
      missingRanges: missingRanges2,
      reconciliation
    };
  } catch (error) {
    const syncError = error instanceof HousevipSyncError ? error : new HousevipSyncError("sync_failed", "HOUSEVIP MetaAds sync failed");
    const finishedAt = nowIso2(now);
    const existing = runId ? await first3(db, `SELECT status FROM sync_runs WHERE id=?`, runId) : null;
    if (existing?.status === "running") {
      if (generationId) {
        await run3(
          db,
          `UPDATE data_generations SET status='failed',availability='error',freshness='stale',sealed_at=?,details_json=?
            WHERE organization_id=? AND project_id=? AND id=? AND status='staging'`,
          finishedAt,
          JSON.stringify({ reason: syncError.code }),
          ORGANIZATION_ID,
          PROJECT_ID,
          generationId
        );
      }
      await finishRun(db, runId, "error", finishedAt, {
        rowsRead,
        rowsWritten: 0,
        message: syncError.message,
        details: { code: syncError.code, generationId }
      });
      await updateIntegration(db, "error", finishedAt, false);
    }
    throw syncError;
  }
}
__name(syncHousevip, "syncHousevip");
var HOUSEVIP_METAADS_SOURCE = Object.freeze({
  url: METAADS_GVIZ_URL,
  sheet: "MetaAds",
  sourceTimezone: SOURCE_TIMEZONE,
  sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
  mappingVersion: MAPPING_VERSION
});

// src/real-commerce-import.js
import { createHash } from "node:crypto";
var ORGANIZATION_ID2 = "org_toys_agency";
var SCHEMA_VERSION = "toys-private-commerce-snapshot/1.0";
var MAPPING_VERSION2 = "real-commerce-private/1";
var PROFIT_BOOK = "1eue_NxKtqVbm3UQtb2DuN0b9snFvOKs-YF_Bi3KzaJw";
var KARL_ADS_BOOK = "1cEx4TQ9P8hJuLmwoxMaryFEk-zduI_jBa4TlsBLU-hk";
var KARL_PROJECT_BOOK = "1lTO2Lkon14FBLPxNQ39L9xpku8HIFQjQBPu4p4e8JMc";
var REAL_COMMERCE_PROJECTS = Object.freeze({
  "profkit-instashop-r4vk": Object.freeze({
    id: "prj_profkit_instashop_r4vk",
    slug: "profkit-instashop-r4vk",
    name: "PROFKIT Instashop",
    clientId: "client_profkit",
    clientSlug: "profkit",
    clientName: "PROFKIT",
    preset: "instashop",
    timezone: "Europe/Kyiv",
    currency: "UAH",
    capabilities: ["ads", "instashop", "period_reports"],
    channels: [["meta", "Meta"], ["instashop", "Instashop"]]
  }),
  "karlovarska-sul-k4rm": Object.freeze({
    id: "prj_karlovarska_sul_k4rm",
    slug: "karlovarska-sul-k4rm",
    name: "Karlovarska Sul",
    clientId: "client_karlovarska_sul",
    clientSlug: "karlovarska-sul",
    clientName: "Karlovarska Sul",
    preset: "ecommerce",
    timezone: "Europe/Prague",
    currency: null,
    capabilities: ["ads", "ecommerce", "content", "period_reports"],
    channels: [["meta", "Meta"], ["google", "Google"], ["smm", "SMM"], ["ecommerce", "E-commerce"]]
  })
});
var KARL_TAB_TITLES = /* @__PURE__ */ new Set([
  "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (Meta)",
  "\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Meta)",
  "\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Meta)",
  "\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043E\u0432 (Meta)",
  "\u041A\u0440\u0435\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0431\u0440\u0438\u0444 (Meta)",
  "\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F (Meta)",
  "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (Google)",
  "\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Google)",
  "\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Google)",
  "\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 (Google)",
  "\u041E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F (Google)",
  "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (SMM)",
  "\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 (SMM)",
  "\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F (SMM)",
  "\u0418\u0434\u0435\u0438 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 (SMM)",
  "\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043F\u043B\u0430\u043D \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C (SMM)",
  "\u0422\u0417 \u0420\u0438\u043B\u0441 \u043E\u043A\u0442\u044F\u0431\u0440\u044C (SMM)",
  "\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043F\u043B\u0430\u043D \u043E\u043A\u0442\u044F\u0431\u0440\u044C (SMM)",
  "\u0418\u0434\u0435\u0438 \u0420\u0438\u043B\u0441 \u043D\u043E\u044F\u0431\u0440\u044C (SMM)"
]);
var PUBLIC_TAB_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
var PUBLIC_TAB_SENSITIVE_HEADER = /^(?:phone|telephone|e-?mail|lead(?: id| name)?|customer (?:name|phone|email)|телефон|тел\.?|почта|имя лида|контакт лида)$/i;
function assertPublicTabPrivacy(title, values) {
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    for (const raw of values[rowIndex]) {
      const text4 = typeof raw === "string" ? raw.trim() : "";
      if (!text4) continue;
      if (PUBLIC_TAB_EMAIL.test(text4)) fail5("project_tab_pii", `${title}: email-like value is not allowed`);
      const digits2 = (text4.match(/\d/g) || []).length;
      if (digits2 >= 9 && digits2 <= 15 && /^[+\d][\d\s().-]+\d$/.test(text4) && (text4.startsWith("+") || /[\s()-]/.test(text4))) {
        fail5("project_tab_pii", `${title}: phone-like value is not allowed`);
      }
      if (rowIndex < 5 && text4.length <= 64 && PUBLIC_TAB_SENSITIVE_HEADER.test(text4)) {
        fail5("project_tab_pii", `${title}: sensitive contact column is not allowed`);
      }
    }
  }
}
__name(assertPublicTabPrivacy, "assertPublicTabPrivacy");
var RealCommerceImportError = class extends Error {
  static {
    __name(this, "RealCommerceImportError");
  }
  constructor(code, message2 = code, details = null) {
    super(message2);
    this.name = "RealCommerceImportError";
    this.code = code;
    this.details = details;
  }
};
function fail5(code, message2, details) {
  throw new RealCommerceImportError(code, message2, details);
}
__name(fail5, "fail");
function sha(value2) {
  return createHash("sha256").update(String(value2)).digest("hex");
}
__name(sha, "sha");
function canonicalJson(value2) {
  if (value2 === null || typeof value2 !== "object") return JSON.stringify(value2);
  if (Array.isArray(value2)) return `[${value2.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value2).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value2[key])}`).join(",")}}`;
}
__name(canonicalJson, "canonicalJson");
function canonicalHash(value2) {
  return sha(canonicalJson(value2));
}
__name(canonicalHash, "canonicalHash");
function date(value2, field) {
  if (typeof value2 === "number" && Number.isFinite(value2)) {
    const day = Math.floor(value2);
    if (day <= 0 || day > 1e5) fail5("invalid_date", `${field}: invalid Excel serial`);
    return new Date(Date.UTC(1899, 11, 30 + day)).toISOString().slice(0, 10);
  }
  const text4 = String(value2 ?? "").trim();
  const candidate = text4.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!candidate) fail5("invalid_date", `${field}: expected ISO date or Excel serial`);
  const parsed = /* @__PURE__ */ new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) fail5("invalid_date", `${field}: invalid calendar date`);
  return candidate;
}
__name(date, "date");
function addDay(value2) {
  const d = /* @__PURE__ */ new Date(`${value2}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
__name(addDay, "addDay");
function missingDateRanges(values, reason) {
  const dates = [...new Set(values)].sort();
  const ranges = [];
  for (const value2 of dates) {
    const previous = ranges.at(-1);
    if (previous && previous.toExclusive === value2) previous.toExclusive = addDay(value2);
    else ranges.push({ from: value2, toExclusive: addDay(value2), state: "unclassified", reason });
  }
  return ranges;
}
__name(missingDateRanges, "missingDateRanges");
function decimal4(value2, field, { integer = false, nullable = false } = {}) {
  if (value2 == null || String(value2).trim() === "") {
    if (nullable) return null;
    fail5("invalid_metric", `${field}: value is required`);
  }
  let text4 = typeof value2 === "number" ? String(value2) : String(value2).trim().replace(",", ".");
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text4)) fail5("invalid_metric", `${field}: expected decimal`);
  if (integer && text4.includes(".")) fail5("invalid_metric", `${field}: expected integer`);
  let sign = "";
  if (text4.startsWith("-")) {
    sign = "-";
    text4 = text4.slice(1);
  }
  let [whole, fraction = ""] = text4.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  fraction = fraction.replace(/0+$/, "");
  const result = `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
  if (result.startsWith("-")) fail5("invalid_metric", `${field}: negative values are not allowed`);
  return result;
}
__name(decimal4, "decimal");
function decimalParts2(value2) {
  const [whole, fraction = ""] = value2.split(".");
  return { n: BigInt(`${whole}${fraction}`), scale: fraction.length };
}
__name(decimalParts2, "decimalParts");
function addDecimals2(values) {
  if (!values.length) return "0";
  const parts = values.map(decimalParts2), scale = Math.max(...parts.map((item) => item.scale));
  const sum = parts.reduce((total, item) => total + item.n * 10n ** BigInt(scale - item.scale), 0n);
  const digits2 = sum.toString().padStart(scale + 1, "0");
  return decimal4(scale ? `${digits2.slice(0, -scale)}.${digits2.slice(-scale)}` : digits2, "sum");
}
__name(addDecimals2, "addDecimals");
function scaleOf2(value2) {
  return value2 == null || !value2.includes(".") ? 0 : value2.length - value2.indexOf(".") - 1;
}
__name(scaleOf2, "scaleOf");
function normalizedAccount(value2) {
  return String(value2 ?? "").trim().replace(/^act_/i, "");
}
__name(normalizedAccount, "normalizedAccount");
function norm(value2) {
  return String(value2 ?? "").trim();
}
__name(norm, "norm");
function slug(value2) {
  return String(value2).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 36);
}
__name(slug, "slug");
function table2(snapshot, key, requiredHeader, { workbook, sheet, optionalHeader = [] } = {}) {
  const source = snapshot?.tables?.[key];
  if (!source || !Array.isArray(source.values)) fail5("missing_table", `${key}: table is required`);
  if (workbook && source.spreadsheet_id !== workbook) fail5("source_mismatch", `${key}: unexpected workbook`);
  if (sheet && source.sheet !== sheet) fail5("source_mismatch", `${key}: expected sheet ${sheet}`);
  const header = (source.values[0] || []).map(norm);
  requiredHeader.forEach((name, index) => {
    if (header[index] !== name) fail5("schema_mismatch", `${key}: column ${index + 1} must be ${name}`);
  });
  for (const name of header.slice(requiredHeader.length)) {
    if (!optionalHeader.includes(name)) fail5("schema_mismatch", `${key}: unexpected column ${name}`);
  }
  return { source, header, rows: source.values.slice(1), index: Object.fromEntries(header.map((name, index) => [name, index])) };
}
__name(table2, "table");
function value(row, source, column) {
  const index = source.index[column];
  return index == null ? null : row[index];
}
__name(value, "value");
function observedMetric(code, raw, unit, currency3, options = {}) {
  const parsed = decimal4(raw, code, { integer: options.integer, nullable: true });
  if (parsed == null) return { code, version: "1", basis: options.basis || "source_native", value: null, scale: 0, unit, currency: currency3 || null, state: options.missingState || "missing", qualityFlags: options.qualityFlags || [], originRefs: [] };
  return { code, version: "1", basis: options.basis || "source_native", value: parsed, scale: scaleOf2(parsed), unit, currency: currency3 || null, state: "observed", qualityFlags: options.qualityFlags || [], originRefs: [] };
}
__name(observedMetric, "observedMetric");
function rowKey(parts) {
  return parts.map((item) => String(item ?? "")).join("");
}
__name(rowKey, "rowKey");
function legacyGroupIdentity(stream, account, currency3, campaignLabel) {
  return `legacy:${canonicalHash({
    streamKey: stream.key,
    channelKey: stream.channelKey,
    accountRef: normalizedAccount(account),
    currency: norm(currency3).toUpperCase(),
    campaignLabel: String(campaignLabel ?? "")
  }).slice(0, 24)}`;
}
__name(legacyGroupIdentity, "legacyGroupIdentity");
function finishStream(project, descriptor, rows, extras = {}) {
  rows.sort((a, b) => a.observationKey.localeCompare(b.observationKey));
  const keys = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (keys.has(row.observationKey)) fail5("duplicate_observation", `${descriptor.key}: duplicate observation key`);
    keys.add(row.observationKey);
    row.metrics.sort((a, b) => rowKey([a.code, a.version, a.basis]).localeCompare(rowKey([b.code, b.version, b.basis])));
  }
  const stream = { ...descriptor, rows, ...extras };
  stream.sourceHash = canonicalHash({ descriptor: { ...descriptor }, rows });
  stream.sourceStreamId = `src_${slug(project.slug)}_${slug(descriptor.key)}`;
  stream.generationId = `gen_${slug(project.slug)}_${slug(descriptor.key)}_${stream.sourceHash.slice(0, 20)}`;
  const dates = rows.map((row) => row.localDate).sort();
  stream.observedFrom = dates[0] || null;
  stream.observedToExclusive = dates.length ? addDay(dates.at(-1)) : null;
  stream.requestedFrom ||= stream.observedFrom;
  stream.requestedToExclusive ||= stream.observedToExclusive;
  stream.coverage ||= "complete";
  stream.freshness ||= "fresh";
  stream.missingRanges ||= [];
  return stream;
}
__name(finishStream, "finishStream");
function observation(project, stream, row, localDate, fields, metrics) {
  const observationKey2 = rowKey(fields.key);
  return {
    observationKey: observationKey2,
    localDate,
    timezone: stream.sourceTimezone || project.timezone,
    reportingDateBasis: "source_local_date",
    grain: stream.grain,
    accountRef: fields.accountRef || null,
    providerCampaignId: fields.providerCampaignId || null,
    legacyGroupRef: fields.legacyGroupRef || null,
    legacyCampaignLabel: fields.campaign || null,
    sourceRecordRef: `${stream.key}:${sha(observationKey2).slice(0, 24)}`,
    metrics
  };
}
__name(observation, "observation");
function parseWeekly(source, project) {
  const rows = [];
  for (let index = 0; index < source.rows.length; index += 1) {
    const raw = source.rows[index];
    if (!raw.some((item) => norm(item))) continue;
    const start = date(value(raw, source, "period_start"), `${source.source.sheet}[${index + 2}].period_start`);
    const end = date(value(raw, source, "period_end"), `${source.source.sheet}[${index + 2}].period_end`);
    if (end < start) fail5("invalid_weekly", `${source.source.sheet}[${index + 2}]: period is reversed`);
    const status = norm(value(raw, source, "status")).toLowerCase() || "published";
    if (!["draft", "published"].includes(status)) fail5("invalid_weekly", `${source.source.sheet}[${index + 2}]: invalid status`);
    const sourceId = norm(value(raw, source, "id"));
    rows.push({
      id: `weekly_${slug(project.slug)}_${sha(rowKey([sourceId, start, end])).slice(0, 20)}`,
      sourceId,
      periodStart: start,
      periodEnd: end,
      summary: norm(value(raw, source, "summary")),
      wins: norm(value(raw, source, "wins")),
      issues: norm(value(raw, source, "issues")),
      changes: norm(value(raw, source, "changes")),
      nextSteps: norm(value(raw, source, "next_steps")),
      status,
      createdAt: norm(value(raw, source, "created_at")) || null,
      updatedAt: norm(value(raw, source, "updated_at")) || null
    });
  }
  rows.sort((a, b) => rowKey([a.periodStart, a.periodEnd, a.id]).localeCompare(rowKey([b.periodStart, b.periodEnd, b.id])));
  return rows;
}
__name(parseWeekly, "parseWeekly");
var WEEKLY_HEADER = ["id", "period_start", "period_end", "summary", "wins", "issues", "changes", "next_steps", "status", "created_at", "updated_at"];
function sourceDeliveryProvider(snapshot) {
  return snapshot?.delivery_provider === "public_gviz" ? "public_gviz" : "private_snapshot";
}
__name(sourceDeliveryProvider, "sourceDeliveryProvider");
function parseProfkit(snapshot) {
  const project = REAL_COMMERCE_PROJECTS["profkit-instashop-r4vk"];
  const meta = table2(snapshot, "profkit_meta", ["date", "platform", "account_name", "account_id", "currency", "campaign", "impressions", "clicks", "cost", "conversions"], { workbook: PROFIT_BOOK, sheet: "MetaAds", optionalHeader: ["spend_usd", "fx_usd_uah", "meta_direct_inquiries"] });
  const sales = table2(snapshot, "profkit_sales", ["date", "qualified_inquiries", "unqualified_inquiries", "direct_inquiries", "sales", "revenue_uah"], { workbook: PROFIT_BOOK, sheet: "InstashopSales", optionalHeader: ["avg_check_uah", "source_tab", "source_url"] });
  const fx = table2(snapshot, "profkit_fx", ["date", "usd_uah", "source_url"], { workbook: PROFIT_BOOK, sheet: "FxRates" });
  const weekly = table2(snapshot, "profkit_weekly", WEEKLY_HEADER, { workbook: PROFIT_BOOK, sheet: "WeeklyComments" });
  const deliveryProvider = sourceDeliveryProvider(snapshot);
  const metaDescriptor = { key: "profkit_meta", channelKey: "instashop", viewRole: "ads", deliveryProvider, businessProvider: "meta_ads", stableSourceRef: `${PROFIT_BOOK}:MetaAds`, sourceTimezone: "America/Los_Angeles", grain: "campaign_daily", sourceSchemaVersion: `${SCHEMA_VERSION}/profkit-meta`, attributionModel: "unknown", attributionWindow: "unknown" };
  const fxLookup = new Map(fx.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => [
    date(value(raw, fx, "date"), `profkit_fx[${index + 2}].date`),
    decimal4(value(raw, fx, "usd_uah"), "usd_uah")
  ]));
  const metaRows = [];
  meta.rows.forEach((raw, index) => {
    const hasDate = value(raw, meta, "date") != null && norm(value(raw, meta, "date")) !== "";
    const hasMetrics = ["impressions", "clicks", "cost", "conversions", "spend_usd", "fx_usd_uah", "meta_direct_inquiries"].some((name) => value(raw, meta, name) != null && norm(value(raw, meta, name)) !== "");
    if (!hasDate && !hasMetrics) return;
    const localDate = date(value(raw, meta, "date"), `profkit_meta[${index + 2}].date`);
    const currency3 = norm(value(raw, meta, "currency")).toUpperCase();
    if (currency3 !== "UAH") fail5("source_mismatch", `profkit_meta[${index + 2}]: expected UAH`);
    const account = normalizedAccount(value(raw, meta, "account_id")), campaign = norm(value(raw, meta, "campaign"));
    if (!account || !campaign) fail5("schema_mismatch", `profkit_meta[${index + 2}]: account and campaign are required`);
    const conversions = decimal4(value(raw, meta, "conversions"), "profkit_meta.conversions", { nullable: true });
    const direct = decimal4(value(raw, meta, "meta_direct_inquiries"), "profkit_meta.meta_direct_inquiries", { nullable: true });
    if (conversions != null && direct != null && conversions !== direct) fail5("cross_stream_mismatch", `Profkit Meta direct attribution mismatch on ${localDate}`);
    const rowFx = decimal4(value(raw, meta, "fx_usd_uah"), "profkit_meta.fx_usd_uah", { nullable: true });
    if (rowFx != null && rowFx !== fxLookup.get(localDate)) fail5("cross_stream_mismatch", `Profkit FX mismatch on ${localDate}`);
    const spendUah = decimal4(value(raw, meta, "cost"), "profkit_meta.cost", { nullable: true });
    const spendUsd = decimal4(value(raw, meta, "spend_usd"), "profkit_meta.spend_usd", { nullable: true });
    if (spendUah != null && spendUsd != null && rowFx != null) {
      const actual = Number(spendUah), converted = Number(spendUsd) * Number(rowFx);
      if (Math.abs(actual - converted) > Math.max(0.05, 1e-3 * Math.abs(actual))) fail5("cross_stream_mismatch", `Profkit converted spend mismatch on ${localDate}`);
    }
    metaRows.push(observation(project, metaDescriptor, raw, localDate, { key: [localDate, account, campaign, currency3], accountRef: account, legacyGroupRef: legacyGroupIdentity(metaDescriptor, account, currency3, campaign), campaign }, [
      observedMetric("ads.spend_uah", value(raw, meta, "cost"), "money", "UAH", { basis: "platform_reported" }),
      observedMetric("ads.raw_spend_usd", value(raw, meta, "spend_usd"), "money", "USD", { basis: "platform_reported" }),
      observedMetric("ads.impressions", value(raw, meta, "impressions"), "count", null, { integer: true, basis: "platform_reported" }),
      observedMetric("ads.clicks", value(raw, meta, "clicks"), "count", null, { integer: true, basis: "platform_reported" }),
      observedMetric("instashop.meta_direct", value(raw, meta, "meta_direct_inquiries"), "weighted_count", null, { basis: "platform_reported" })
    ]));
  });
  const salesDescriptor = { key: "profkit_sales", channelKey: "instashop", viewRole: "sales", deliveryProvider, businessProvider: "instashop", stableSourceRef: `${PROFIT_BOOK}:InstashopSales`, sourceTimezone: "America/Los_Angeles", grain: "project_daily", sourceSchemaVersion: `${SCHEMA_VERSION}/profkit-sales` };
  const salesRows = sales.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => {
    const localDate = date(value(raw, sales, "date"), `profkit_sales[${index + 2}].date`);
    return observation(project, salesDescriptor, raw, localDate, { key: [localDate, "project"] }, [
      observedMetric("instashop.direct_inquiries", value(raw, sales, "direct_inquiries"), "count", null, { integer: true }),
      observedMetric("instashop.qualified_inquiries", value(raw, sales, "qualified_inquiries"), "count", null, { integer: true }),
      observedMetric("instashop.unqualified_inquiries", value(raw, sales, "unqualified_inquiries"), "count", null, { integer: true }),
      observedMetric("instashop.sales_count", value(raw, sales, "sales"), "count", null, { integer: true }),
      observedMetric("instashop.revenue_uah", value(raw, sales, "revenue_uah"), "money", "UAH")
    ]);
  });
  const fxDescriptor = { key: "profkit_fx", channelKey: "instashop", viewRole: "exchange_rate", deliveryProvider, businessProvider: "nbu_fx", stableSourceRef: `${PROFIT_BOOK}:FxRates`, sourceTimezone: "America/Los_Angeles", grain: "project_daily", sourceSchemaVersion: `${SCHEMA_VERSION}/profkit-fx` };
  const fxRows = fx.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => {
    const localDate = date(value(raw, fx, "date"), `profkit_fx[${index + 2}].date`);
    return observation(project, fxDescriptor, raw, localDate, { key: [localDate, "USD", "UAH"] }, [observedMetric("fx.usd_uah", value(raw, fx, "usd_uah"), "exchange_rate", null)]);
  });
  const streams = [finishStream(project, metaDescriptor, metaRows), finishStream(project, salesDescriptor, salesRows), finishStream(project, fxDescriptor, fxRows)];
  validateProfkit(streams);
  return finishProject(project, streams, parseWeekly(weekly, project), [], {
    exchangeRates: fx.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => ({
      date: date(value(raw, fx, "date"), `profkit_fx[${index + 2}].date`),
      rate: decimal4(value(raw, fx, "usd_uah"), "usd_uah"),
      sourceUrl: norm(value(raw, fx, "source_url"))
    }))
  });
}
__name(parseProfkit, "parseProfkit");
function metric2(row, code) {
  return row.metrics.find((item) => item.code === code);
}
__name(metric2, "metric");
function validateProfkit(streams) {
  const [, sales] = streams;
  for (const row of sales.rows) {
    const direct = metric2(row, "instashop.direct_inquiries"), qualified = metric2(row, "instashop.qualified_inquiries"), unqualified = metric2(row, "instashop.unqualified_inquiries");
    if ([direct, qualified, unqualified].every((item) => item.state === "observed") && direct.value !== addDecimals2([qualified.value, unqualified.value])) fail5("cross_stream_mismatch", `Profkit direct inquiries mismatch on ${row.localDate}`);
  }
}
__name(validateProfkit, "validateProfkit");
function karlAdsStream(snapshot, key, sheet, businessProvider, channelKey) {
  const project = REAL_COMMERCE_PROJECTS["karlovarska-sul-k4rm"];
  const source = table2(snapshot, key, ["date", "platform", "account_name", "account_id", "currency", "campaign", "impressions", "clicks", "cost", "conversions", "conv_value"], { workbook: KARL_ADS_BOOK, sheet });
  const descriptor = { key, channelKey, viewRole: "ads_campaign", deliveryProvider: sourceDeliveryProvider(snapshot), businessProvider, stableSourceRef: `${KARL_ADS_BOOK}:${sheet}`, sourceTimezone: "Asia/Tbilisi", grain: "campaign_daily", sourceSchemaVersion: `${SCHEMA_VERSION}/karl-ads`, attributionModel: "unknown", attributionWindow: "unknown" };
  const rows = source.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => {
    const localDate = date(value(raw, source, "date"), `${key}[${index + 2}].date`), currency3 = norm(value(raw, source, "currency")).toUpperCase();
    const account = normalizedAccount(value(raw, source, "account_id")), campaign = norm(value(raw, source, "campaign"));
    const platform = norm(value(raw, source, "platform")).toLowerCase();
    const expectedPlatform = businessProvider === "google_ads" ? "google ads" : "meta ads";
    if (platform !== expectedPlatform) fail5("source_mismatch", `${key}[${index + 2}]: unexpected platform`);
    if (!currency3 || !account || !campaign) fail5("schema_mismatch", `${key}[${index + 2}]: currency, account and campaign required`);
    return observation(project, descriptor, raw, localDate, { key: [localDate, platform, account, campaign, currency3], accountRef: account, legacyGroupRef: legacyGroupIdentity(descriptor, account, currency3, campaign), campaign }, [
      observedMetric("ads.impressions", value(raw, source, "impressions"), "count", null, { integer: true, basis: "platform_reported" }),
      observedMetric("ads.clicks", value(raw, source, "clicks"), "count", null, { integer: true, basis: "platform_reported" }),
      observedMetric("ads.spend", value(raw, source, "cost"), "money", currency3, { basis: "platform_reported" }),
      observedMetric("ads.reported_conversions", value(raw, source, "conversions"), "weighted_count", null, { basis: "platform_reported" }),
      observedMetric("ads.reported_conversion_value", value(raw, source, "conv_value"), "money", currency3, { basis: "platform_reported" })
    ]);
  });
  return finishStream(project, descriptor, rows);
}
__name(karlAdsStream, "karlAdsStream");
var ECOM_METRICS = [
  ["add_to_cart", "ecom.add_to_cart", "weighted_count", false],
  ["add_to_cart_value", "ecom.add_to_cart_value", "money", false],
  ["checkout", "ecom.checkout", "weighted_count", false],
  ["checkout_value", "ecom.checkout_value", "money", false],
  ["purchase", "ecom.purchases", "weighted_count", false],
  ["purchase_value", "ecom.purchase_value", "money", false]
];
function karlEcomStream(snapshot, key, campaignGrain) {
  const project = REAL_COMMERCE_PROJECTS["karlovarska-sul-k4rm"];
  const base = ["date", "platform", "account_name", "account_id", "currency"];
  const header = [...base, ...campaignGrain ? ["campaign", "campaign_id"] : [], ...ECOM_METRICS.map((item) => item[0])];
  const expectedSheet = campaignGrain ? "EcomFunnelCampaign" : "EcomFunnel";
  const source = table2(snapshot, key, header, { workbook: KARL_ADS_BOOK, sheet: expectedSheet });
  const descriptor = { key, channelKey: "ecommerce", viewRole: campaignGrain ? "campaign" : "account", deliveryProvider: sourceDeliveryProvider(snapshot), businessProvider: "ecommerce", stableSourceRef: `${KARL_ADS_BOOK}:${source.source.sheet}`, sourceTimezone: "Asia/Tbilisi", grain: campaignGrain ? "campaign_daily" : "account_daily", sourceSchemaVersion: `${SCHEMA_VERSION}/karl-ecommerce`, attributionModel: "unknown", attributionWindow: "unknown" };
  const currencyMissingDates = [];
  const rows = source.rows.filter((raw) => raw.some((item) => norm(item))).map((raw, index) => {
    const localDate = date(value(raw, source, "date"), `${key}[${index + 2}].date`), platform = norm(value(raw, source, "platform")).toLowerCase();
    const account = normalizedAccount(value(raw, source, "account_id")), currency3 = norm(value(raw, source, "currency")).toUpperCase();
    if (!account || !platform) fail5("schema_mismatch", `${key}[${index + 2}]: account and platform required`);
    const campaign = campaignGrain ? norm(value(raw, source, "campaign")) : null;
    const campaignId = campaignGrain ? norm(value(raw, source, "campaign_id")) : null;
    if (campaignGrain && (!campaign || !campaignId || !currency3)) fail5("schema_mismatch", `${key}[${index + 2}]: campaign identity and currency required`);
    if (!currency3) currencyMissingDates.push(localDate);
    const metrics = ECOM_METRICS.map(([column, code, unit, integer]) => {
      if (unit === "money" && !currency3) return observedMetric(code, null, unit, null, { basis: "platform_reported", missingState: "unclassified", qualityFlags: ["currency_missing_source"] });
      return observedMetric(code, value(raw, source, column), unit, unit === "money" ? currency3 : null, { integer, basis: "platform_reported" });
    });
    return observation(project, descriptor, raw, localDate, {
      key: [localDate, platform, account, currency3 || "currency-missing", ...campaignGrain ? [campaignId] : []],
      accountRef: account,
      providerCampaignId: campaignGrain ? campaignId : null,
      campaign
    }, metrics);
  });
  const missingRanges2 = missingDateRanges(currencyMissingDates, "currency_missing_source");
  return finishStream(project, descriptor, rows, { coverage: missingRanges2.length ? "partial" : "complete", missingRanges: missingRanges2 });
}
__name(karlEcomStream, "karlEcomStream");
function validateKarl(account, campaign) {
  const codes = ECOM_METRICS.map((item) => item[1]);
  const key = /* @__PURE__ */ __name((row) => rowKey([row.localDate, row.accountRef, row.observationKey.split("")[1], row.metrics.find((item) => item.unit === "money")?.currency || "currency-missing"]), "key");
  const accountMap = new Map(account.rows.map((row) => [key(row), row]));
  const campaignGroups = /* @__PURE__ */ new Map();
  for (const row of campaign.rows) campaignGroups.set(key(row), [...campaignGroups.get(key(row)) || [], row]);
  for (const [campaignKey, rows] of campaignGroups) {
    const expected = accountMap.get(campaignKey);
    if (!expected) fail5("cross_stream_mismatch", `Karlovarska campaign-only ecommerce key ${campaignKey}`);
    for (const code of codes) {
      const target = metric2(expected, code), parts = rows.map((row) => metric2(row, code));
      const total = parts.every((item) => item.state === "observed") ? addDecimals2(parts.map((item) => item.value)) : null;
      const equal = total != null && Math.abs(Number(target.value) - Number(total)) <= 1e-9 * Math.max(1, Math.abs(Number(target.value)));
      if (target.state !== "observed" || !equal) {
        fail5("cross_stream_mismatch", `Karlovarska ecommerce mismatch for ${code}`);
      }
    }
  }
}
__name(validateKarl, "validateKarl");
function parseKarl(snapshot, projectTabs) {
  const project = REAL_COMMERCE_PROJECTS["karlovarska-sul-k4rm"];
  const google = karlAdsStream(snapshot, "karl_google", "GoogleAds", "google_ads", "google");
  const meta = karlAdsStream(snapshot, "karl_meta", "MetaAds", "meta_ads", "meta");
  const account = karlEcomStream(snapshot, "karl_ecom", false), campaign = karlEcomStream(snapshot, "karl_ecom_campaign", true);
  validateKarl(account, campaign);
  const weekly = table2(snapshot, "karl_weekly", WEEKLY_HEADER, { workbook: KARL_ADS_BOOK, sheet: "WeeklyComments" });
  return finishProject(project, [google, meta, account, campaign], parseWeekly(weekly, project), parseKarlTabs(projectTabs), {});
}
__name(parseKarl, "parseKarl");
function tabMode(title) {
  const base = title.replace(/ \((?:SMM|Meta|Google)\)$/, "");
  if (base === "\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B") return "task-tracker";
  if (base === "\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430" || base === "\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430") return "weekly-report";
  if (base === "\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043E\u0432") return "competitors";
  if (base === "\u041A\u0440\u0435\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0431\u0440\u0438\u0444") return "creative-brief";
  return "table";
}
__name(tabMode, "tabMode");
function gviz(values, { raw = false } = {}) {
  const width = Math.max(0, ...values.map((row) => Array.isArray(row) ? row.length : 0));
  const header = values[0] || [], rows = raw ? values : values.slice(values.length ? 1 : 0);
  return { version: "0.6", status: "ok", table: { cols: Array.from({ length: width }, (_, index) => ({ id: String.fromCharCode(65 + index % 26), label: raw ? "" : norm(header[index]), type: !raw && typeof header[index] === "number" ? "number" : "string" })), rows: rows.map((row) => ({ c: Array.from({ length: width }, (_, index) => row[index] == null ? null : { v: row[index] }) })) } };
}
__name(gviz, "gviz");
function parseKarlTabs(snapshot) {
  if (snapshot == null) return [];
  if (snapshot.spreadsheet_id !== KARL_PROJECT_BOOK || !Array.isArray(snapshot.tabs)) fail5("source_mismatch", "Karlovarska project-tabs snapshot has an unexpected workbook or shape");
  const seen = /* @__PURE__ */ new Set(), tabs = [];
  snapshot.tabs.forEach((tab, position) => {
    const title = norm(tab?.title), suffix = title.match(/ \((SMM|Meta|Google)\)$/)?.[1];
    if (!suffix || !KARL_TAB_TITLES.has(title)) fail5("project_tab_forbidden", `Karlovarska tab is not allowlisted: ${title || "(blank)"}`);
    if (seen.has(title)) fail5("duplicate_project_tab", `duplicate Karlovarska tab: ${title}`);
    seen.add(title);
    if (!Array.isArray(tab.values) || tab.values.some((row) => !Array.isArray(row))) fail5("schema_mismatch", `${title}: values must be row arrays`);
    assertPublicTabPrivacy(title, tab.values);
    const content = gviz(tab.values), rawContent = gviz(tab.values, { raw: true }), sourceHash = canonicalHash({ title, values: tab.values });
    tabs.push({ id: `tab_karl_${sourceHash.slice(0, 20)}`, channel: suffix.toLowerCase(), channelKey: suffix.toLowerCase(), tabKey: `${suffix.toLowerCase()}_${sha(title).slice(0, 20)}`, sourceTitle: title, label: title.replace(/ \((?:SMM|Meta|Google)\)$/, ""), mode: tabMode(title), position, content, rawContent, sourceHash });
  });
  return tabs;
}
__name(parseKarlTabs, "parseKarlTabs");
function finishProject(project, streams, weeklyReports2, projectTabs, extras) {
  const descriptor = /* @__PURE__ */ __name((stream) => ({
    key: stream.key,
    channel: stream.channelKey,
    channelKey: stream.channelKey,
    viewRole: stream.viewRole,
    sourceStreamId: stream.sourceStreamId,
    generationId: stream.generationId,
    sourceHash: stream.sourceHash,
    grain: stream.grain,
    coverage: stream.coverage,
    requestedRange: { from: stream.requestedFrom, toExclusive: stream.requestedToExclusive },
    missingRanges: stream.missingRanges,
    attribution: {
      model: stream.attributionModel || "not_applicable",
      window: stream.attributionWindow || "not_applicable"
    }
  }), "descriptor");
  const auxiliaryRole = /* @__PURE__ */ __name((stream) => ["exchange_rate", "ads_campaign"].includes(stream.viewRole), "auxiliaryRole");
  const datasets = streams.filter((stream) => !auxiliaryRole(stream)).map(descriptor).sort((a, b) => a.key.localeCompare(b.key));
  const auxiliaryStreams = streams.filter(auxiliaryRole).map(descriptor).sort((a, b) => a.key.localeCompare(b.key));
  const sourceHash = canonicalHash({ schemaVersion: SCHEMA_VERSION, project: project.slug, datasets, auxiliaryStreams, weeklyReports: weeklyReports2, projectTabs: projectTabs.map((tab) => ({ sourceTitle: tab.sourceTitle, sourceHash: tab.sourceHash })), exchangeRates: extras.exchangeRates || [] });
  return { ...project, streams, weeklyReports: weeklyReports2, projectTabs, ...extras, sourceHash, releaseId: `rel_${slug(project.slug)}_${sourceHash.slice(0, 24)}`, manifest: { schemaVersion: SCHEMA_VERSION, projectSlug: project.slug, datasets, auxiliaryStreams, weeklyHash: canonicalHash(weeklyReports2), projectTabsHash: canonicalHash(projectTabs.map((tab) => ({ sourceTitle: tab.sourceTitle, sourceHash: tab.sourceHash }))), sourceHash } };
}
__name(finishProject, "finishProject");
function parsePrivateSnapshot(snapshot, { projectTabs = null, projects = null } = {}) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.tables || typeof snapshot.captured_at !== "string") fail5("invalid_snapshot", "snapshot must contain captured_at and tables");
  const selected = projects == null ? Object.keys(REAL_COMMERCE_PROJECTS) : Array.isArray(projects) ? projects : [projects];
  for (const slugValue of selected) if (!REAL_COMMERCE_PROJECTS[slugValue]) fail5("unknown_project", `unsupported project: ${slugValue}`);
  const parsed = [];
  if (selected.includes("profkit-instashop-r4vk")) parsed.push(parseProfkit(snapshot));
  if (selected.includes("karlovarska-sul-k4rm")) parsed.push(parseKarl(snapshot, projectTabs));
  return { schemaVersion: SCHEMA_VERSION, capturedAt: snapshot.captured_at, projects: parsed };
}
__name(parsePrivateSnapshot, "parsePrivateSnapshot");
function statement2(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings);
}
__name(statement2, "statement");
async function first4(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).first();
}
__name(first4, "first");
async function all3(db, sql, ...bindings) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results || [];
}
__name(all3, "all");
async function run4(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).run();
}
__name(run4, "run");
async function batches(db, statements, size = 80) {
  const chunkSize = Number.isInteger(db.batchSize) && db.batchSize > 0 ? db.batchSize : size;
  for (let index = 0; index < statements.length; index += chunkSize) await db.batch(statements.slice(index, index + chunkSize));
}
__name(batches, "batches");
function observationHash(row) {
  const copy = { ...row };
  delete copy.metrics;
  return canonicalHash(copy);
}
__name(observationHash, "observationHash");
function readbackSort(a, b) {
  return rowKey([a.observationKey, a.metricCode, a.metricVersion, a.valueBasis]).localeCompare(rowKey([b.observationKey, b.metricCode, b.metricVersion, b.valueBasis]));
}
__name(readbackSort, "readbackSort");
function normalizeRecord(record) {
  return {
    observationKey: record.observationKey,
    localDate: record.localDate,
    sourceTimezone: record.sourceTimezone,
    reportingDateBasis: record.reportingDateBasis,
    grain: record.grain,
    accountRef: record.accountRef || null,
    providerCampaignId: record.providerCampaignId || null,
    legacyGroupRef: record.legacyGroupRef || null,
    legacyCampaignLabel: record.legacyCampaignLabel || null,
    sourceRecordRef: record.sourceRecordRef,
    observationSourceHash: record.observationSourceHash,
    metricCode: record.metricCode,
    metricVersion: record.metricVersion,
    valueBasis: record.valueBasis,
    valueText: record.valueText == null ? null : String(record.valueText),
    scale: Number(record.scale),
    unit: record.unit,
    currency: record.currency || null,
    valueState: record.valueState,
    qualityFlagsJson: record.qualityFlagsJson,
    originRefsJson: record.originRefsJson
  };
}
__name(normalizeRecord, "normalizeRecord");
function reconcileReadback(stream, records) {
  const expected = stream.rows.flatMap((row) => row.metrics.map((item) => ({
    observationKey: row.observationKey,
    localDate: row.localDate,
    sourceTimezone: row.timezone,
    reportingDateBasis: row.reportingDateBasis,
    grain: row.grain,
    accountRef: row.accountRef,
    providerCampaignId: row.providerCampaignId,
    legacyGroupRef: row.legacyGroupRef,
    legacyCampaignLabel: row.legacyCampaignLabel,
    sourceRecordRef: row.sourceRecordRef,
    observationSourceHash: observationHash(row),
    metricCode: item.code,
    metricVersion: item.version,
    valueBasis: item.basis,
    valueText: item.value,
    scale: item.scale,
    unit: item.unit,
    currency: item.currency,
    valueState: item.state,
    qualityFlagsJson: JSON.stringify(item.qualityFlags),
    originRefsJson: JSON.stringify(item.originRefs)
  }))).sort(readbackSort);
  const actual = records.map(normalizeRecord).sort(readbackSort);
  return { ok: canonicalJson(actual) === canonicalJson(expected), expected: { observations: stream.rows.length, facts: expected.length, hash: canonicalHash(expected) }, actual: { observations: new Set(actual.map((row) => row.observationKey)).size, facts: actual.length, hash: canonicalHash(actual) } };
}
__name(reconcileReadback, "reconcileReadback");
async function reconcileGeneration2(db, project, stream, generationId = stream.generationId) {
  const records = await all3(db, `SELECT o.observation_key AS observationKey,o.local_date AS localDate,o.source_timezone AS sourceTimezone,
    o.reporting_date_basis AS reportingDateBasis,o.grain,o.account_ref AS accountRef,o.provider_campaign_id AS providerCampaignId,
    o.legacy_group_ref AS legacyGroupRef,o.legacy_campaign_label AS legacyCampaignLabel,o.source_record_ref AS sourceRecordRef,
    o.source_hash AS observationSourceHash,v.metric_code AS metricCode,v.metric_version AS metricVersion,v.value_basis AS valueBasis,
    v.value_text AS valueText,v.scale,v.unit,v.currency,v.value_state AS valueState,v.quality_flags_json AS qualityFlagsJson,
    v.origin_refs_json AS originRefsJson FROM fact_observations o JOIN fact_values v ON v.observation_id=o.id
    WHERE o.organization_id=? AND o.project_id=? AND o.generation_id=? ORDER BY o.observation_key,v.metric_code,v.metric_version,v.value_basis`, ORGANIZATION_ID2, project.id, generationId);
  return reconcileReadback(stream, records);
}
__name(reconcileGeneration2, "reconcileGeneration");
function factStatements(db, project, stream) {
  const statements = [];
  for (const row of stream.rows) {
    const id = `obs_${slug(project.slug)}_${sha(`${stream.generationId}${row.observationKey}`).slice(0, 24)}`;
    statements.push(statement2(db, `INSERT OR IGNORE INTO fact_observations
      (id,organization_id,project_id,generation_id,source_stream_id,observation_key,local_date,source_timezone,reporting_date_basis,grain,account_ref,provider_campaign_id,legacy_group_ref,legacy_campaign_label,source_record_ref,source_hash)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, ORGANIZATION_ID2, project.id, stream.generationId, stream.sourceStreamId, row.observationKey, row.localDate, row.timezone, row.reportingDateBasis, row.grain, row.accountRef, row.providerCampaignId, row.legacyGroupRef, row.legacyCampaignLabel, row.sourceRecordRef, observationHash(row)));
    for (const item of row.metrics) statements.push(statement2(db, `INSERT OR IGNORE INTO fact_values
      (organization_id,project_id,observation_id,metric_code,metric_version,value_basis,value_text,scale,unit,currency,value_state,quality_flags_json,origin_refs_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, ORGANIZATION_ID2, project.id, id, item.code, item.version, item.basis, item.value, item.scale, item.unit, item.currency, item.state, JSON.stringify(item.qualityFlags), JSON.stringify(item.originRefs)));
  }
  return statements;
}
__name(factStatements, "factStatements");
async function stageStream(db, project, stream, at) {
  await run4(
    db,
    `INSERT INTO source_streams
    (id,organization_id,project_id,channel_key,delivery_provider,business_provider,stable_source_ref,provider_account_ref,source_timezone,grain,source_schema_version,mapping_version,capabilities_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,project_id,stable_source_ref) DO UPDATE SET
    delivery_provider=excluded.delivery_provider,business_provider=excluded.business_provider,source_timezone=excluded.source_timezone,
    grain=excluded.grain,source_schema_version=excluded.source_schema_version,mapping_version=excluded.mapping_version`,
    stream.sourceStreamId,
    ORGANIZATION_ID2,
    project.id,
    stream.channelKey,
    stream.deliveryProvider,
    stream.businessProvider,
    stream.stableSourceRef,
    null,
    stream.sourceTimezone || project.timezone,
    stream.grain,
    stream.sourceSchemaVersion,
    MAPPING_VERSION2,
    JSON.stringify([...new Set(stream.rows.flatMap((row) => row.metrics.map((item) => item.code)))])
  );
  const existing = await first4(db, `SELECT status,source_hash AS sourceHash FROM data_generations WHERE organization_id=? AND project_id=? AND id=?`, ORGANIZATION_ID2, project.id, stream.generationId);
  if (existing && existing.sourceHash !== stream.sourceHash) fail5("generation_collision", `${stream.key}: deterministic generation collision`);
  if (existing && !["staging", "sealed"].includes(existing.status)) fail5("generation_blocked", `${stream.key}: generation is ${existing.status}`);
  if (!existing) await run4(
    db,
    `INSERT INTO data_generations
    (id,organization_id,project_id,source_stream_id,idempotency_key,source_hash,status,availability,coverage,freshness,requested_from,requested_to_exclusive,observed_from,observed_to_exclusive,row_count,missing_ranges_json,generated_at,details_json)
    VALUES (?,?,?,?,?,?,'staging','ok',?,?,?,?,?,?,?,?,?,?)`,
    stream.generationId,
    ORGANIZATION_ID2,
    project.id,
    stream.sourceStreamId,
    canonicalHash([stream.sourceStreamId, stream.sourceHash, MAPPING_VERSION2]),
    stream.sourceHash,
    stream.coverage,
    stream.freshness,
    stream.requestedFrom,
    stream.requestedToExclusive,
    stream.observedFrom,
    stream.observedToExclusive,
    stream.rows.length,
    JSON.stringify(stream.missingRanges),
    at,
    JSON.stringify({
      privateSnapshot: stream.deliveryProvider === "private_snapshot",
      source: stream.deliveryProvider,
      personalDataIncluded: false,
      privacyClassification: "business_reporting_no_lead_pii",
      mappingVersion: MAPPING_VERSION2,
      attribution: {
        model: stream.attributionModel || "not_applicable",
        window: stream.attributionWindow || "not_applicable"
      }
    })
  );
  if (!existing || existing.status === "staging") await batches(db, factStatements(db, project, stream));
  const reconciliation = await reconcileGeneration2(db, project, stream);
  if (!reconciliation.ok) {
    await run4(db, `UPDATE data_generations SET status='quarantined',availability='error',freshness='stale',sealed_at=?,details_json=? WHERE organization_id=? AND project_id=? AND id=? AND status='staging'`, at, JSON.stringify({ reason: "readback_reconciliation_mismatch", reconciliation }), ORGANIZATION_ID2, project.id, stream.generationId);
    fail5("reconciliation_mismatch", `${stream.key}: exact readback reconciliation failed`, reconciliation);
  }
  await run4(db, `UPDATE data_generations SET status='sealed',sealed_at=? WHERE organization_id=? AND project_id=? AND id=? AND status='staging'`, at, ORGANIZATION_ID2, project.id, stream.generationId);
  return reconciliation;
}
__name(stageStream, "stageStream");
function conditionalExtras(db, project, at) {
  const statements = [];
  const condition = `EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=? AND release_id=?)`;
  for (const report of project.weeklyReports) statements.push(statement2(db, `INSERT OR IGNORE INTO weekly_reports
    (id,project_id,period_start,period_end,summary,wins,issues,changes,next_steps,status,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${condition}`, report.id, project.id, report.periodStart, report.periodEnd, report.summary, report.wins, report.issues, report.changes, report.nextSteps, report.status, report.createdAt || at, report.updatedAt || at, ORGANIZATION_ID2, project.id, project.releaseId));
  for (const tab of project.projectTabs) statements.push(statement2(
    db,
    `INSERT INTO project_tabs
    (id,project_id,channel,tab_key,source_title,label,mode,position,content_json,raw_content_json,source_hash,imported_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${condition} ON CONFLICT(project_id,tab_key) DO UPDATE SET
    source_title=excluded.source_title,label=excluded.label,mode=excluded.mode,position=excluded.position,content_json=excluded.content_json,
    raw_content_json=excluded.raw_content_json,source_hash=excluded.source_hash,updated_at=excluded.updated_at`,
    tab.id,
    project.id,
    tab.channel,
    tab.tabKey,
    tab.sourceTitle,
    tab.label,
    tab.mode,
    tab.position,
    JSON.stringify(tab.content),
    JSON.stringify(tab.rawContent),
    tab.sourceHash,
    at,
    at,
    ORGANIZATION_ID2,
    project.id,
    project.releaseId
  ));
  for (const rate of project.exchangeRates || []) statements.push(statement2(
    db,
    `INSERT OR IGNORE INTO exchange_rates
    (rate_date,base_currency,quote_currency,rate,source,fetched_at) SELECT ?,'USD','UAH',? ,?,? WHERE ${condition}`,
    rate.date,
    Number(rate.rate),
    rate.sourceUrl ? `NBU:${rate.sourceUrl}` : "NBU",
    at,
    ORGANIZATION_ID2,
    project.id,
    project.releaseId
  ));
  return statements;
}
__name(conditionalExtras, "conditionalExtras");
async function verifyExtras(db, project) {
  for (const report of project.weeklyReports) {
    const row = await first4(db, `SELECT period_start AS periodStart,period_end AS periodEnd,summary,wins,issues,changes,next_steps AS nextSteps,status FROM weekly_reports WHERE project_id=? AND period_start=? AND period_end=?`, project.id, report.periodStart, report.periodEnd);
    const expected = { periodStart: report.periodStart, periodEnd: report.periodEnd, summary: report.summary, wins: report.wins, issues: report.issues, changes: report.changes, nextSteps: report.nextSteps, status: report.status };
    if (canonicalJson(row) !== canonicalJson(expected)) fail5("weekly_reconciliation_mismatch", `${project.slug}: weekly readback mismatch`);
  }
  for (const tab of project.projectTabs) {
    const row = await first4(db, `SELECT source_hash AS sourceHash FROM project_tabs WHERE project_id=? AND tab_key=?`, project.id, tab.tabKey);
    if (row?.sourceHash !== tab.sourceHash) fail5("project_tab_reconciliation_mismatch", `${project.slug}: project tab readback mismatch`);
  }
  for (const rate of project.exchangeRates || []) {
    const row = await first4(db, `SELECT CAST(rate AS TEXT) AS rate,source FROM exchange_rates WHERE rate_date=? AND base_currency='USD' AND quote_currency='UAH'`, rate.date);
    const expectedSource = rate.sourceUrl ? `NBU:${rate.sourceUrl}` : "NBU";
    if (!row || decimal4(row.rate, "rate") !== rate.rate || row.source !== expectedSource) fail5("exchange_rate_reconciliation_mismatch", `${project.slug}: FX readback mismatch`);
  }
}
__name(verifyExtras, "verifyExtras");
async function preflightExtras(db, project) {
  for (const report of project.weeklyReports) {
    const row = await first4(db, `SELECT period_start AS periodStart,period_end AS periodEnd,summary,wins,issues,changes,next_steps AS nextSteps,status FROM weekly_reports WHERE project_id=? AND period_start=? AND period_end=?`, project.id, report.periodStart, report.periodEnd);
    if (!row) continue;
    const expected = { periodStart: report.periodStart, periodEnd: report.periodEnd, summary: report.summary, wins: report.wins, issues: report.issues, changes: report.changes, nextSteps: report.nextSteps, status: report.status };
    if (canonicalJson(row) !== canonicalJson(expected)) fail5("weekly_conflict", `${project.slug}: an immutable weekly period already has different content`);
  }
  for (const rate of project.exchangeRates || []) {
    const row = await first4(db, `SELECT CAST(rate AS TEXT) AS rate,source FROM exchange_rates WHERE rate_date=? AND base_currency='USD' AND quote_currency='UAH'`, rate.date);
    const expectedSource = rate.sourceUrl ? `NBU:${rate.sourceUrl}` : "NBU";
    if (row && (decimal4(row.rate, "rate") !== rate.rate || row.source !== expectedSource)) fail5("exchange_rate_conflict", `${project.slug}: an immutable USD/UAH rate already differs`);
  }
}
__name(preflightExtras, "preflightExtras");
async function importRealCommerceProject(db, project, { now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now") } = {}) {
  if (!db?.prepare || !db?.batch) fail5("database_unavailable", "D1-compatible database is required");
  const atValue = now();
  const at = (atValue instanceof Date ? atValue : new Date(atValue)).toISOString();
  const registry = await first4(db, `SELECT id,organization_id AS organizationId,status FROM projects WHERE id=?`, project.id);
  if (!registry || registry.organizationId !== ORGANIZATION_ID2) fail5("project_unavailable", `${project.slug}: project registry row is unavailable`);
  await preflightExtras(db, project);
  const initial = await first4(db, `SELECT p.release_id AS releaseId,p.pointer_revision AS pointerRevision,r.source_hash AS sourceHash FROM project_data_release_pointers p JOIN project_data_releases r ON r.id=p.release_id WHERE p.organization_id=? AND p.project_id=?`, ORGANIZATION_ID2, project.id);
  const initialRevision = Number(initial?.pointerRevision || 0), initialReleaseId = initial?.releaseId || null;
  const reconciliations = {};
  for (const stream of project.streams) reconciliations[stream.key] = await stageStream(db, project, stream, at);
  if (initial?.sourceHash === project.sourceHash) {
    if (initial.releaseId !== project.releaseId) fail5("active_release_invalid", `${project.slug}: active hash has a non-canonical release id`);
    if (registry.status !== "active") fail5("active_release_invalid", `${project.slug}: current release points at an inactive project`);
    await verifyExtras(db, project);
    return { ok: true, status: "already_current", projectSlug: project.slug, releaseId: initial.releaseId, sourceHash: project.sourceHash, pointerRevision: initialRevision, reconciliations };
  }
  await run4(db, `INSERT INTO clients (id,organization_id,slug,name,status) VALUES (?,?,?,?,'active') ON CONFLICT(organization_id,slug) DO UPDATE SET name=excluded.name`, project.clientId, ORGANIZATION_ID2, project.clientSlug, project.clientName);
  const configId = `cfg_${slug(project.slug)}_${project.sourceHash.slice(0, 20)}`;
  const config = project.preset === "instashop" ? { defaultView: "instashop", screens: ["instashop"], currencyPolicy: { conversion: "daily_nbu_usd_to_uah", spendUahMetric: "ads.spend_uah", rawSpendUsdMetric: "ads.raw_spend_usd", additive: false }, salesGrain: "project_daily", sourceState: "active_release", contentNavigation: [] } : { defaultView: "metrics", screens: ["ecommerce"], currencyPolicy: "native_separate", viewsAreAlternative: true, sourceState: "active_release", contentNavigation: ["smm", "meta", "google"] };
  const publish = [
    statement2(db, `INSERT OR IGNORE INTO project_data_releases (id,organization_id,project_id,revision,status,manifest_json,source_hash,created_at)
      SELECT ?,?,?,COALESCE(MAX(revision),0)+1,'sealed',?,?,? FROM project_data_releases WHERE organization_id=? AND project_id=?`, project.releaseId, ORGANIZATION_ID2, project.id, JSON.stringify(project.manifest), project.sourceHash, at, ORGANIZATION_ID2, project.id),
    statement2(db, `INSERT OR IGNORE INTO project_data_release_pointers (organization_id,project_id,release_id,pointer_revision,updated_at)
      SELECT ?,?,?,1,? WHERE ?=0 AND NOT EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=?)`, ORGANIZATION_ID2, project.id, project.releaseId, at, initialRevision, ORGANIZATION_ID2, project.id),
    statement2(db, `UPDATE project_data_release_pointers SET release_id=?,pointer_revision=pointer_revision+1,updated_at=?
      WHERE organization_id=? AND project_id=? AND pointer_revision=? AND release_id=? AND release_id<>?`, project.releaseId, at, ORGANIZATION_ID2, project.id, initialRevision, initialReleaseId, project.releaseId),
    statement2(
      db,
      `INSERT OR IGNORE INTO dashboard_config_revisions (id,organization_id,project_id,revision_number,schema_version,preset,config_json,status)
      SELECT ?,?,?,COALESCE((SELECT MAX(revision_number) FROM dashboard_config_revisions WHERE organization_id=? AND project_id=?),0)+1,
             'toys-dashboard-config/1.0',?,?,'published'
       WHERE EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=? AND release_id=?)`,
      configId,
      ORGANIZATION_ID2,
      project.id,
      ORGANIZATION_ID2,
      project.id,
      project.preset,
      JSON.stringify(config),
      ORGANIZATION_ID2,
      project.id,
      project.releaseId
    ),
    statement2(
      db,
      `INSERT INTO dashboard_config_pointers (organization_id,project_id,revision_id,updated_at)
      SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=? AND release_id=?)
      ON CONFLICT(organization_id,project_id) DO UPDATE SET revision_id=excluded.revision_id,updated_at=excluded.updated_at`,
      ORGANIZATION_ID2,
      project.id,
      configId,
      at,
      ORGANIZATION_ID2,
      project.id,
      project.releaseId
    ),
    ...project.channels.map(([key, label]) => statement2(db, `INSERT OR IGNORE INTO project_channels (organization_id,project_id,channel_key,label,status) SELECT ?,?,?,?,'active' WHERE EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=? AND release_id=?)`, ORGANIZATION_ID2, project.id, key, label, ORGANIZATION_ID2, project.id, project.releaseId)),
    ...conditionalExtras(db, project, at),
    statement2(
      db,
      `UPDATE projects SET client_id=?,project_type=?,currency=?,timezone=?,status='active',capabilities_json=?,active_preset=?,default_locale='ru',settings_json=?,updated_at=?
      WHERE organization_id=? AND id=? AND EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=? AND project_id=? AND release_id=?)`,
      project.clientId,
      project.preset,
      project.currency,
      project.timezone,
      JSON.stringify(project.capabilities),
      project.preset,
      JSON.stringify({ dataBackend: "d1", projectBackend: "d1", weeklyBackend: "d1", legacyRuntimeUntouched: true, privateSnapshotImporter: SCHEMA_VERSION }),
      at,
      ORGANIZATION_ID2,
      project.id,
      ORGANIZATION_ID2,
      project.id,
      project.releaseId
    )
  ];
  await db.batch(publish);
  const after = await first4(db, `SELECT p.release_id AS releaseId,p.pointer_revision AS pointerRevision,pj.status FROM project_data_release_pointers p JOIN projects pj ON pj.id=p.project_id WHERE p.organization_id=? AND p.project_id=?`, ORGANIZATION_ID2, project.id);
  if (after?.releaseId !== project.releaseId || after.status !== "active") fail5("cas_conflict", `${project.slug}: composite release publication CAS failed`, { initialRevision, initialReleaseId, currentReleaseId: after?.releaseId || null });
  await verifyExtras(db, project);
  return { ok: true, status: "published", projectSlug: project.slug, releaseId: project.releaseId, sourceHash: project.sourceHash, pointerRevision: Number(after.pointerRevision), reconciliations };
}
__name(importRealCommerceProject, "importRealCommerceProject");
var REAL_COMMERCE_INTERNALS = Object.freeze({ ORGANIZATION_ID: ORGANIZATION_ID2, SCHEMA_VERSION, MAPPING_VERSION: MAPPING_VERSION2, PROFIT_BOOK, KARL_ADS_BOOK, KARL_PROJECT_BOOK, KARL_TAB_TITLES });

// src/real-commerce-sync.js
var { PROFIT_BOOK: PROFIT_BOOK2, KARL_ADS_BOOK: KARL_ADS_BOOK2, KARL_PROJECT_BOOK: KARL_PROJECT_BOOK2 } = REAL_COMMERCE_INTERNALS;
var JOB_TYPE = "real-commerce-gviz-daily";
var MAX_SOURCE_BYTES2 = 8e6;
var MAX_SOURCE_ROWS2 = 1e4;
var MAX_SOURCE_COLUMNS = 80;
var DEFAULT_TIMEOUT_MS = 2e4;
var PROJECT_SPECS = Object.freeze({
  "profkit-instashop-r4vk": Object.freeze({
    tables: Object.freeze([
      { key: "profkit_meta", spreadsheetId: PROFIT_BOOK2, sheet: "MetaAds", gid: 315876840, headers: 1 },
      { key: "profkit_sales", spreadsheetId: PROFIT_BOOK2, sheet: "InstashopSales", gid: 1446281510, headers: 1 },
      { key: "profkit_fx", spreadsheetId: PROFIT_BOOK2, sheet: "FxRates", gid: 936349631, headers: 1 },
      { key: "profkit_weekly", spreadsheetId: PROFIT_BOOK2, sheet: "WeeklyComments", gid: 2059813284, headers: 1 }
    ]),
    projectTabs: Object.freeze([])
  }),
  "karlovarska-sul-k4rm": Object.freeze({
    tables: Object.freeze([
      { key: "karl_google", spreadsheetId: KARL_ADS_BOOK2, sheet: "GoogleAds", gid: 0, headers: 1 },
      { key: "karl_meta", spreadsheetId: KARL_ADS_BOOK2, sheet: "MetaAds", gid: 1497070797, headers: 1 },
      { key: "karl_ecom", spreadsheetId: KARL_ADS_BOOK2, sheet: "EcomFunnel", gid: 1766858417, headers: 1 },
      { key: "karl_ecom_campaign", spreadsheetId: KARL_ADS_BOOK2, sheet: "EcomFunnelCampaign", gid: 713545123, headers: 1 },
      { key: "karl_weekly", spreadsheetId: KARL_ADS_BOOK2, sheet: "WeeklyComments", gid: 299239841, headers: 1 }
    ]),
    projectTabs: Object.freeze([
      ["\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (Meta)", 1573751154],
      ["\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Meta)", 2020683816],
      ["\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Meta)", 905844796],
      ["\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u043A\u0443\u0440\u0435\u043D\u0442\u043E\u0432 (Meta)", 118278129],
      ["\u041A\u0440\u0435\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0431\u0440\u0438\u0444 (Meta)", 65581392],
      ["\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F (Meta)", 153807577],
      ["\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (Google)", 1273008772],
      ["\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Google)", 285813732, true],
      ["\u041C\u0435\u0441\u044F\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 (Google)", 1413680168],
      ["\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 (Google)", 773569530],
      ["\u041E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F (Google)", 952683325],
      ["\u041F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u044B (SMM)", 1787148352],
      ["\u0410\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 (SMM)", 728827176],
      ["\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F (SMM)", 28018977],
      ["\u0418\u0434\u0435\u0438 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 (SMM)", 808680560],
      ["\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043F\u043B\u0430\u043D \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C (SMM)", 609632400],
      ["\u0422\u0417 \u0420\u0438\u043B\u0441 \u043E\u043A\u0442\u044F\u0431\u0440\u044C (SMM)", 2028218045],
      ["\u041A\u043E\u043D\u0442\u0435\u043D\u0442-\u043F\u043B\u0430\u043D \u043E\u043A\u0442\u044F\u0431\u0440\u044C (SMM)", 1773643340],
      ["\u0418\u0434\u0435\u0438 \u0420\u0438\u043B\u0441 \u043D\u043E\u044F\u0431\u0440\u044C (SMM)", 1699620504]
    ].map(([sheet, gid, allowEmpty = false]) => ({
      key: `project_tab_${gid}`,
      spreadsheetId: KARL_PROJECT_BOOK2,
      sheet,
      gid,
      headers: 0,
      allowEmpty
    })))
  })
});
var RealCommerceSyncError = class extends Error {
  static {
    __name(this, "RealCommerceSyncError");
  }
  constructor(code, message2 = code, details = null) {
    super(message2);
    this.name = "RealCommerceSyncError";
    this.code = code;
    this.details = details;
  }
};
function fail6(code, message2, details = null) {
  throw new RealCommerceSyncError(code, message2, details);
}
__name(fail6, "fail");
function nowIso3(now) {
  const value2 = now();
  const date2 = value2 instanceof Date ? value2 : new Date(value2);
  if (Number.isNaN(date2.getTime())) fail6("invalid_now", "sync clock returned an invalid date");
  return date2.toISOString();
}
__name(nowIso3, "nowIso");
function gvizUrl(spec) {
  const query = new URLSearchParams({ tqx: "out:json", headers: String(spec.headers), gid: String(spec.gid) });
  return `https://docs.google.com/spreadsheets/d/${spec.spreadsheetId}/gviz/tq?${query}`;
}
__name(gvizUrl, "gvizUrl");
function isoDateValue(value2) {
  const match = String(value2 || "").match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,.*)?\)$/);
  if (!match) return value2;
  const year = Number(match[1]), month = Number(match[2]) + 1, day = Number(match[3]);
  const date2 = new Date(Date.UTC(year, month - 1, day));
  if (date2.getUTCFullYear() !== year || date2.getUTCMonth() + 1 !== month || date2.getUTCDate() !== day) {
    fail6("invalid_gviz", "GViz returned an invalid date cell");
  }
  return date2.toISOString().slice(0, 10);
}
__name(isoDateValue, "isoDateValue");
function cellValue2(cell) {
  if (cell == null) return null;
  if (cell.v == null) return cell.f == null ? null : cell.f;
  return isoDateValue(cell.v);
}
__name(cellValue2, "cellValue");
function trimValues(values) {
  const rows = values.map((row) => [...row]);
  while (rows.length && rows.at(-1).every((value2) => value2 == null || String(value2).trim() === "")) rows.pop();
  let width = 0;
  for (const row of rows) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index] != null && String(row[index]).trim() !== "") {
        width = Math.max(width, index + 1);
        break;
      }
    }
  }
  return rows.map((row) => row.slice(0, width));
}
__name(trimValues, "trimValues");
function parseGvizTable(text4, spec) {
  const raw = String(text4 || "");
  const marker = "google.visualization.Query.setResponse(";
  const start = raw.indexOf(marker), end = raw.lastIndexOf(");");
  if (start < 0 || end <= start) fail6("invalid_gviz", `${spec.key}: invalid GViz response`, { table: spec.key });
  let payload;
  try {
    payload = JSON.parse(raw.slice(start + marker.length, end));
  } catch (_) {
    fail6("invalid_gviz", `${spec.key}: invalid GViz JSON`, { table: spec.key });
  }
  if (payload?.status === "error") fail6("source_error", `${spec.key}: GViz reported an error`, { table: spec.key });
  const table3 = payload?.table;
  if (!table3 || !Array.isArray(table3.cols) || !Array.isArray(table3.rows)) {
    fail6("schema_mismatch", `${spec.key}: GViz table is missing`, { table: spec.key });
  }
  if (table3.cols.length > MAX_SOURCE_COLUMNS || table3.rows.length > MAX_SOURCE_ROWS2) {
    fail6("source_too_large", `${spec.key}: GViz table exceeds safety limits`, { table: spec.key });
  }
  const header = table3.cols.map((column) => String(column?.label || "").trim());
  const rows = table3.rows.map((row) => table3.cols.map((_, index) => cellValue2(row?.c?.[index])));
  const values = trimValues(spec.headers === 0 ? rows : [header, ...rows]);
  if (!values.length && !spec.allowEmpty) fail6("empty_source", `${spec.key}: source table is empty`, { table: spec.key });
  return values;
}
__name(parseGvizTable, "parseGvizTable");
async function fetchGvizTable(fetchImpl, spec, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response5 = await fetchImpl(gvizUrl(spec), {
      method: "GET",
      headers: { accept: "application/json,text/plain;q=0.9" },
      signal: controller.signal
    });
    if (!response5?.ok) {
      fail6("source_http_error", `${spec.key}: source HTTP ${response5?.status || "error"}`, {
        table: spec.key,
        status: Number(response5?.status || 0)
      });
    }
    const declaredLength = Number(response5.headers?.get?.("content-length") || 0);
    if (declaredLength > MAX_SOURCE_BYTES2) {
      fail6("source_too_large", `${spec.key}: source response exceeds safety limit`, { table: spec.key });
    }
    const text4 = await response5.text();
    if (new TextEncoder().encode(text4).byteLength > MAX_SOURCE_BYTES2) {
      fail6("source_too_large", `${spec.key}: source response exceeds safety limit`, { table: spec.key });
    }
    return {
      spec,
      httpStatus: response5.status,
      values: parseGvizTable(text4, spec)
    };
  } catch (error) {
    if (error instanceof RealCommerceSyncError) throw error;
    if (controller.signal.aborted) fail6("source_timeout", `${spec.key}: source request timed out`, { table: spec.key });
    fail6("source_unavailable", `${spec.key}: source request failed`, { table: spec.key });
  } finally {
    clearTimeout(timeout);
  }
}
__name(fetchGvizTable, "fetchGvizTable");
async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}
__name(mapWithConcurrency, "mapWithConcurrency");
async function loadRealCommerceSource(projectSlug, {
  fetchImpl = fetch,
  now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now"),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const config = PROJECT_SPECS[projectSlug];
  if (!config) fail6("unknown_project", `unsupported scheduled project: ${projectSlug}`);
  if (typeof fetchImpl !== "function") fail6("fetch_unavailable", "fetch implementation is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail6("invalid_timeout", "timeoutMs must be positive");
  const tables = await mapWithConcurrency(config.tables, 4, (spec) => fetchGvizTable(fetchImpl, spec, timeoutMs));
  const projectTabs = await mapWithConcurrency(config.projectTabs, 4, (spec) => fetchGvizTable(fetchImpl, spec, timeoutMs));
  const snapshot = {
    captured_at: nowIso3(now),
    delivery_provider: "public_gviz",
    tables: Object.fromEntries(tables.map(({ spec, values, httpStatus }) => [spec.key, {
      spreadsheet_id: spec.spreadsheetId,
      sheet: spec.sheet,
      range: `gid=${spec.gid}`,
      http_status: httpStatus,
      values
    }]))
  };
  const tabsSnapshot = projectTabs.length ? {
    captured_at: snapshot.captured_at,
    spreadsheet_id: KARL_PROJECT_BOOK2,
    tabs: projectTabs.map(({ spec, values }) => ({ title: spec.sheet, values }))
  } : null;
  const parsed = parsePrivateSnapshot(snapshot, { projects: projectSlug, projectTabs: tabsSnapshot });
  const rowsRead = tables.reduce((total, table3) => total + Math.max(0, table3.values.length - 1), 0) + projectTabs.reduce((total, table3) => total + table3.values.length, 0);
  return {
    project: parsed.projects[0],
    rowsRead,
    source: {
      tables: tables.map(({ spec, httpStatus, values }) => ({ key: spec.key, sheet: spec.sheet, httpStatus, rows: Math.max(0, values.length - 1) })),
      projectTabs: projectTabs.map(({ spec, httpStatus, values }) => ({ sheet: spec.sheet, httpStatus, rows: values.length }))
    }
  };
}
__name(loadRealCommerceSource, "loadRealCommerceSource");
function sortedSet(values) {
  return [...new Set(values.filter((value2) => value2 != null && String(value2).trim() !== "").map((value2) => String(value2)))].sort();
}
__name(sortedSet, "sortedSet");
function equalSets(left, right) {
  return left.length === right.length && left.every((value2, index) => value2 === right[index]);
}
__name(equalSets, "equalSets");
async function first5(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).first();
}
__name(first5, "first");
async function all4(db, sql, ...bindings) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results || [];
}
__name(all4, "all");
async function preflightRealCommerceProject(db, project) {
  const active = await first5(db, `SELECT r.manifest_json AS manifestJson
    FROM project_data_release_pointers p JOIN project_data_releases r ON r.id=p.release_id
    WHERE p.organization_id=? AND p.project_id=?`, REAL_COMMERCE_INTERNALS.ORGANIZATION_ID, project.id);
  if (!active) fail6("active_release_missing", `${project.slug}: active release is required before scheduled refresh`);
  let manifest;
  try {
    manifest = JSON.parse(active.manifestJson);
  } catch (_) {
    fail6("active_release_invalid", `${project.slug}: active release manifest is invalid`);
  }
  const activeStreams = [...manifest.datasets || [], ...manifest.auxiliaryStreams || []];
  const summary = [];
  for (const stream of project.streams) {
    const descriptor = activeStreams.find((item) => item.key === stream.key);
    if (!descriptor?.generationId) fail6("active_release_invalid", `${project.slug}: active stream ${stream.key} is missing`);
    const generation = await first5(
      db,
      `SELECT status,observed_from AS observedFrom,observed_to_exclusive AS observedToExclusive
      FROM data_generations WHERE organization_id=? AND project_id=? AND id=?`,
      REAL_COMMERCE_INTERNALS.ORGANIZATION_ID,
      project.id,
      descriptor.generationId
    );
    if (!generation || generation.status !== "sealed") fail6("active_release_invalid", `${project.slug}: active stream ${stream.key} is not sealed`);
    if (!stream.observedFrom || !stream.observedToExclusive || !generation.observedFrom || !generation.observedToExclusive) {
      fail6("source_range_invalid", `${project.slug}: ${stream.key} has no comparable coverage`);
    }
    const overlaps = stream.observedFrom < generation.observedToExclusive && generation.observedFrom < stream.observedToExclusive;
    const monotonic = stream.observedFrom <= generation.observedFrom && stream.observedToExclusive >= generation.observedToExclusive;
    if (!overlaps || !monotonic) {
      fail6("source_history_regression", `${project.slug}: ${stream.key} no longer covers the active range`, {
        stream: stream.key,
        currentFrom: generation.observedFrom,
        currentToExclusive: generation.observedToExclusive,
        candidateFrom: stream.observedFrom,
        candidateToExclusive: stream.observedToExclusive
      });
    }
    const currentAccounts = sortedSet((await all4(
      db,
      `SELECT DISTINCT account_ref AS value FROM fact_observations
      WHERE organization_id=? AND project_id=? AND generation_id=? AND account_ref IS NOT NULL`,
      REAL_COMMERCE_INTERNALS.ORGANIZATION_ID,
      project.id,
      descriptor.generationId
    )).map((row) => row.value));
    const candidateAccounts = sortedSet(stream.rows.map((row) => row.accountRef));
    if (!equalSets(currentAccounts, candidateAccounts)) {
      fail6("source_account_mismatch", `${project.slug}: ${stream.key} account scope changed`, {
        stream: stream.key,
        currentAccountCount: currentAccounts.length,
        candidateAccountCount: candidateAccounts.length
      });
    }
    const currentCurrencies = sortedSet((await all4(
      db,
      `SELECT DISTINCT v.currency AS value FROM fact_observations o
      JOIN fact_values v ON v.observation_id=o.id
      WHERE o.organization_id=? AND o.project_id=? AND o.generation_id=? AND v.currency IS NOT NULL`,
      REAL_COMMERCE_INTERNALS.ORGANIZATION_ID,
      project.id,
      descriptor.generationId
    )).map((row) => row.value));
    const candidateCurrencies = sortedSet(stream.rows.flatMap((row) => row.metrics.map((metric3) => metric3.currency)));
    if (!equalSets(currentCurrencies, candidateCurrencies)) {
      fail6("source_currency_mismatch", `${project.slug}: ${stream.key} currency scope changed`, {
        stream: stream.key,
        currentCurrencies,
        candidateCurrencies
      });
    }
    summary.push({
      stream: stream.key,
      rows: stream.rows.length,
      observedFrom: stream.observedFrom,
      observedToExclusive: stream.observedToExclusive,
      accountCount: candidateAccounts.length,
      currencies: candidateCurrencies,
      overlap: true
    });
  }
  return summary;
}
__name(preflightRealCommerceProject, "preflightRealCommerceProject");
async function startRun2(db, projectId, startedAt) {
  await db.prepare(`INSERT INTO sync_runs
    (project_id,provider,job_type,status,started_at,rows_read,rows_written,message,details_json)
    VALUES (?,'google_sheets',?,'running',?,0,0,'Real commerce GViz sync started','{}')`).bind(projectId, JOB_TYPE, startedAt).run();
  const row = await first5(db, `SELECT id FROM sync_runs WHERE project_id=? AND provider='google_sheets'
    AND job_type=? AND started_at=? ORDER BY id DESC LIMIT 1`, projectId, JOB_TYPE, startedAt);
  if (!row?.id) fail6("sync_run_unavailable", "failed to create real commerce sync run");
  return row.id;
}
__name(startRun2, "startRun");
async function finishRun2(db, runId, status, finishedAt, {
  rowsRead = 0,
  rowsWritten = 0,
  message: message2,
  details = {}
} = {}) {
  await db.prepare(`UPDATE sync_runs SET status=?,finished_at=?,rows_read=?,rows_written=?,message=?,details_json=? WHERE id=?`).bind(status, finishedAt, rowsRead, rowsWritten, message2, JSON.stringify(details), runId).run();
}
__name(finishRun2, "finishRun");
function asSyncError(error, projectSlug) {
  if (error instanceof RealCommerceSyncError) return error;
  const code = typeof error?.code === "string" ? error.code : "sync_failed";
  return new RealCommerceSyncError(code, `${projectSlug}: scheduled Sheet refresh failed`, error?.details || null);
}
__name(asSyncError, "asSyncError");
async function syncRealCommerceProject(env, projectSlug, options = {}) {
  const db = env?.TOYS_DB;
  if (!db?.prepare || !db?.batch) fail6("database_unavailable", "TOYS_DB binding is required");
  const expected = PROJECT_SPECS[projectSlug];
  if (!expected) fail6("unknown_project", `unsupported scheduled project: ${projectSlug}`);
  const now = options.now || (() => /* @__PURE__ */ new Date());
  const startedAt = nowIso3(now);
  const registry = await first5(db, `SELECT id FROM projects WHERE slug=? AND status='active'`, projectSlug);
  if (!registry?.id) fail6("project_unavailable", `${projectSlug}: active project is unavailable`);
  const runId = await startRun2(db, registry.id, startedAt);
  let rowsRead = 0;
  try {
    const loaded = await loadRealCommerceSource(projectSlug, { ...options, now });
    rowsRead = loaded.rowsRead;
    const preflight = await preflightRealCommerceProject(db, loaded.project);
    const result = await importRealCommerceProject(db, loaded.project, { now });
    const finishedAt = nowIso3(now);
    const rowsWritten = result.status === "published" ? loaded.project.streams.reduce((total, stream) => total + stream.rows.length, 0) : 0;
    await finishRun2(db, runId, "success", finishedAt, {
      rowsRead,
      rowsWritten,
      message: `${projectSlug}: ${result.status === "published" ? "release published" : "release already current"}`,
      details: {
        status: result.status,
        pointerRevision: result.pointerRevision,
        sourceTables: loaded.source.tables,
        projectTabCount: loaded.source.projectTabs.length,
        preflight
      }
    });
    return { ok: true, projectSlug, rowsRead, rowsWritten, preflight, ...result };
  } catch (error) {
    const syncError = asSyncError(error, projectSlug);
    await finishRun2(db, runId, "error", nowIso3(now), {
      rowsRead,
      rowsWritten: 0,
      message: syncError.message,
      details: { code: syncError.code, ...syncError.details || {} }
    });
    throw syncError;
  }
}
__name(syncRealCommerceProject, "syncRealCommerceProject");
async function syncRealCommerceProjects(env, options = {}) {
  const results = [];
  for (const projectSlug of Object.keys(PROJECT_SPECS)) {
    try {
      results.push(await syncRealCommerceProject(env, projectSlug, options));
    } catch (error) {
      const syncError = asSyncError(error, projectSlug);
      results.push({ ok: false, projectSlug, error: syncError.code, message: syncError.message, details: syncError.details });
    }
  }
  return results;
}
__name(syncRealCommerceProjects, "syncRealCommerceProjects");
async function preflightRealCommerceSources(env, options = {}) {
  const db = env?.TOYS_DB;
  if (!db?.prepare) fail6("database_unavailable", "TOYS_DB binding is required");
  const projects = [];
  for (const projectSlug of Object.keys(PROJECT_SPECS)) {
    const loaded = await loadRealCommerceSource(projectSlug, options);
    const preflight = await preflightRealCommerceProject(db, loaded.project);
    projects.push({
      projectSlug,
      rowsRead: loaded.rowsRead,
      tables: loaded.source.tables,
      projectTabCount: loaded.source.projectTabs.length,
      streams: preflight
    });
  }
  return { ok: true, projects };
}
__name(preflightRealCommerceSources, "preflightRealCommerceSources");
var REAL_COMMERCE_GVIZ_SOURCES = PROJECT_SPECS;

// src/google-ads-cloudrun-adapter.js
var CONTRACT_SCHEMA = "toys-google-ads-readonly-hierarchy/1";
var READ_ONLY_TOOL = "google_ads_reporting_snapshot_v2";
var DEFAULT_ENDPOINT = "https://toys-meta-media-buyer-445015281206.europe-west1.run.app/mcp";
var DEFAULT_MCC_CUSTOMER_ID = "7753894623";
var DEFAULT_API_VERSION2 = "v25";
var REQUIRED_LEVELS = Object.freeze(["campaign", "ad_group", "ad"]);
var LEVEL_ORDER = Object.freeze({ campaign: 0, ad_group: 1, ad: 2 });
var GoogleAdsCloudRunError = class extends Error {
  static {
    __name(this, "GoogleAdsCloudRunError");
  }
  constructor(code, message2 = code, details = null) {
    super(message2);
    this.name = "GoogleAdsCloudRunError";
    this.code = code;
    this.details = details;
  }
};
function fail7(code, message2, details = null) {
  throw new GoogleAdsCloudRunError(code, message2, details);
}
__name(fail7, "fail");
function text3(value2) {
  return String(value2 ?? "").trim();
}
__name(text3, "text");
function digits(value2, field) {
  const normalized = text3(value2).replace(/-/g, "");
  if (!/^\d+$/.test(normalized)) fail7("invalid_config", `${field} must contain digits only`);
  return normalized;
}
__name(digits, "digits");
function normalizedCustomerId(value2, field) {
  const normalized = digits(value2, field);
  if (normalized.length !== 10) fail7("invalid_config", `${field} must contain exactly 10 digits`);
  return normalized;
}
__name(normalizedCustomerId, "normalizedCustomerId");
function providerId(value2, field, { length = null } = {}) {
  if (typeof value2 !== "string" || !/^\d+$/.test(value2) || length != null && value2.length !== length) {
    fail7("provider_schema_mismatch", `${field} must be a ${length ? `${length}-digit ` : ""}string`);
  }
  return value2;
}
__name(providerId, "providerId");
function isoDate3(value2, field) {
  const normalized = text3(value2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) fail7("invalid_date", `${field} must be YYYY-MM-DD`);
  const parsed = /* @__PURE__ */ new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    fail7("invalid_date", `${field} is not a valid calendar date`);
  }
  return normalized;
}
__name(isoDate3, "isoDate");
function currency2(value2, field) {
  const normalized = text3(value2).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) fail7("provider_schema_mismatch", `${field} must be an ISO currency code`);
  return normalized;
}
__name(currency2, "currency");
function timezone2(value2, field) {
  const normalized = text3(value2);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(/* @__PURE__ */ new Date(0));
  } catch (_) {
    fail7("provider_schema_mismatch", `${field} must be an IANA timezone`);
  }
  return normalized;
}
__name(timezone2, "timezone");
function decimal5(value2, field, { integer = false } = {}) {
  if (typeof value2 !== "string") fail7("provider_schema_mismatch", `${field} must be a decimal string`);
  const normalized = value2;
  const expression = integer ? /^\d+$/ : /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
  if (!expression.test(normalized)) fail7("provider_schema_mismatch", `${field} must be a non-negative ${integer ? "integer" : "decimal"}`);
  return normalized;
}
__name(decimal5, "decimal");
function entity2(value2, field, required) {
  if (value2 == null) {
    if (required) fail7("provider_schema_mismatch", `${field} is required`);
    return null;
  }
  if (typeof value2 !== "object" || Array.isArray(value2)) fail7("provider_schema_mismatch", `${field} must be an object`);
  return { id: providerId(value2.id, `${field}.id`), name: text3(value2.name), status: text3(value2.status) || null };
}
__name(entity2, "entity");
function creative(value2, field, required) {
  if (value2 == null) {
    if (required) fail7("provider_schema_mismatch", `${field} is required for ad rows`);
    return null;
  }
  if (typeof value2 !== "object" || Array.isArray(value2)) fail7("provider_schema_mismatch", `${field} must be an object`);
  const ref = text3(value2.ref);
  const type = text3(value2.type);
  if (required && (!ref || !type)) fail7("provider_schema_mismatch", `${field}.ref and ${field}.type are required`);
  if (!Array.isArray(value2.finalUrls)) fail7("provider_schema_mismatch", `${field}.finalUrls must be an array`);
  const finalUrls = value2.finalUrls.map((item, index) => {
    let url;
    try {
      url = new URL(text3(item));
    } catch (_) {
      fail7("provider_schema_mismatch", `${field}.finalUrls[${index}] is invalid`);
    }
    if (url.protocol !== "https:") fail7("provider_schema_mismatch", `${field}.finalUrls[${index}] must use HTTPS`);
    return url.href;
  });
  return { ref, type, finalUrls };
}
__name(creative, "creative");
function normalizedRow(raw, index, scope) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail7("provider_schema_mismatch", `rows[${index}] must be an object`);
  const level = text3(raw.level);
  if (!REQUIRED_LEVELS.includes(level)) fail7("provider_schema_mismatch", `rows[${index}].level is invalid`);
  const date2 = isoDate3(raw.date, `rows[${index}].date`);
  if (date2 < scope.from || date2 > scope.to) fail7("date_scope_mismatch", `rows[${index}].date escaped the requested range`);
  const campaign = entity2(raw.campaign, `rows[${index}].campaign`, true);
  const adGroup = entity2(raw.adGroup, `rows[${index}].adGroup`, level !== "campaign");
  const ad = entity2(raw.ad, `rows[${index}].ad`, level === "ad");
  if (level === "campaign" && (adGroup || ad)) fail7("provider_schema_mismatch", `rows[${index}] has child identity above its grain`);
  if (level === "ad_group" && ad) fail7("provider_schema_mismatch", `rows[${index}] has ad identity at ad_group grain`);
  const metrics = raw.metrics;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) fail7("provider_schema_mismatch", `rows[${index}].metrics is required`);
  const normalizedCreative = creative(raw.creative, `rows[${index}].creative`, level === "ad");
  if (level !== "ad" && normalizedCreative) {
    fail7("provider_schema_mismatch", `rows[${index}] has creative identity above ad grain`);
  }
  if (level === "ad" && normalizedCreative.ref !== `google-ad:${ad.id}`) {
    fail7("provider_schema_mismatch", `rows[${index}].creative.ref does not match the ad ID`);
  }
  return {
    level,
    date: date2,
    campaign,
    adGroup,
    ad,
    creative: normalizedCreative,
    metrics: {
      impressions: decimal5(metrics.impressions, `rows[${index}].metrics.impressions`, { integer: true }),
      clicks: decimal5(metrics.clicks, `rows[${index}].metrics.clicks`, { integer: true }),
      costMicros: decimal5(metrics.costMicros, `rows[${index}].metrics.costMicros`, { integer: true }),
      conversions: decimal5(metrics.conversions, `rows[${index}].metrics.conversions`),
      conversionValue: decimal5(metrics.conversionValue, `rows[${index}].metrics.conversionValue`)
    }
  };
}
__name(normalizedRow, "normalizedRow");
function rowKey2(row) {
  return [row.date, LEVEL_ORDER[row.level], row.campaign.id, row.adGroup?.id || "", row.ad?.id || ""].join("");
}
__name(rowKey2, "rowKey");
function compareIds(left, right) {
  const a = BigInt(left || "0");
  const b = BigInt(right || "0");
  return a < b ? -1 : a > b ? 1 : 0;
}
__name(compareIds, "compareIds");
function compareRows(left, right) {
  return left.date.localeCompare(right.date) || LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level] || compareIds(left.campaign.id, right.campaign.id) || compareIds(left.adGroup?.id, right.adGroup?.id) || compareIds(left.ad?.id, right.ad?.id);
}
__name(compareRows, "compareRows");
function assertCoverage(payload) {
  for (const level of REQUIRED_LEVELS) {
    if (payload?.coverage?.[level]?.complete !== true) {
      fail7("coverage_incomplete", `Cloud Run did not prove complete ${level} coverage`, { level });
    }
  }
}
__name(assertCoverage, "assertCoverage");
function safeInteger(value2, field, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value2 !== "number" || !Number.isSafeInteger(value2) || value2 < minimum || value2 > maximum) {
    fail7("pagination_incomplete", `${field} is invalid`);
  }
  return value2;
}
__name(safeInteger, "safeInteger");
function validateGoogleAdsHierarchyPage(payload, {
  customerId,
  loginCustomerId = DEFAULT_MCC_CUSTOMER_ID,
  apiVersion = DEFAULT_API_VERSION2,
  from,
  to,
  pageSize
} = {}) {
  const expectedCustomerId = normalizedCustomerId(customerId, "customerId");
  const expectedLoginCustomerId = normalizedCustomerId(loginCustomerId, "loginCustomerId");
  const expectedApiVersion = text3(apiVersion);
  const expectedFrom = isoDate3(from, "from");
  const expectedTo = isoDate3(to, "to");
  const expectedPageSize = safeInteger(pageSize, "pageSize", { minimum: 1, maximum: 5e3 });
  if (expectedLoginCustomerId !== DEFAULT_MCC_CUSTOMER_ID) fail7("manager_scope_mismatch", "Google Ads MCC is not approved");
  if (expectedApiVersion !== DEFAULT_API_VERSION2) fail7("api_version_mismatch", "Google Ads API version is not approved");
  const inclusiveDays = (Date.parse(`${expectedTo}T00:00:00Z`) - Date.parse(`${expectedFrom}T00:00:00Z`)) / 864e5 + 1;
  if (inclusiveDays < 1 || inclusiveDays > 90) fail7("invalid_date_range", "Google Ads date range must contain 1 to 90 days");
  if (!payload || payload.schemaVersion !== CONTRACT_SCHEMA || payload.readOnly !== true || payload.writesEnabled !== false) {
    fail7("readonly_contract_violation", "Cloud Run response did not prove read-only execution");
  }
  if (text3(payload.provider) !== "google_ads" || text3(payload.apiVersion) !== expectedApiVersion) {
    fail7("provider_scope_mismatch", "Cloud Run returned an unexpected provider or API version");
  }
  if (providerId(payload.loginCustomerId, "payload.loginCustomerId", { length: 10 }) !== expectedLoginCustomerId || providerId(payload.customer?.id, "payload.customer.id", { length: 10 }) !== expectedCustomerId || payload.customer?.manager !== false) {
    fail7("account_scope_mismatch", "Cloud Run returned an unexpected Google Ads account");
  }
  if (payload.range?.from !== expectedFrom || payload.range?.to !== expectedTo) {
    fail7("date_scope_mismatch", "Cloud Run returned an unexpected date range");
  }
  const snapshotId = text3(payload.snapshotId);
  if (!/^[a-f0-9]{64}$/.test(snapshotId)) {
    fail7("provider_schema_mismatch", "Cloud Run snapshotId must be a lowercase SHA-256 digest");
  }
  assertCoverage(payload);
  const totalRows = safeInteger(payload.page?.totalRows, "payload.page.totalRows");
  const offset = safeInteger(payload.page?.offset, "payload.page.offset");
  const returnedRows = safeInteger(payload.page?.returnedRows, "payload.page.returnedRows", { maximum: expectedPageSize });
  if (safeInteger(payload.page?.pageSize, "payload.page.pageSize", { minimum: 1, maximum: 5e3 }) !== expectedPageSize) {
    fail7("pagination_incomplete", "Cloud Run pageSize changed");
  }
  if (!Array.isArray(payload.rows) || payload.rows.length !== returnedRows) {
    fail7("pagination_incomplete", "Cloud Run returnedRows does not match rows");
  }
  if (offset + returnedRows > totalRows) fail7("pagination_incomplete", "Cloud Run page escaped totalRows");
  const coverageRows = REQUIRED_LEVELS.reduce((sum, level) => sum + safeInteger(payload.coverage?.[level]?.totalRows, `payload.coverage.${level}.totalRows`), 0);
  if (coverageRows !== totalRows) fail7("coverage_incomplete", "Cloud Run coverage totals do not match totalRows");
  const nextCursor = payload.page?.nextCursor == null ? null : text3(payload.page.nextCursor);
  if (nextCursor && (nextCursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(nextCursor))) {
    fail7("pagination_incomplete", "Cloud Run nextCursor is invalid");
  }
  if (nextCursor && offset + returnedRows >= totalRows || !nextCursor && offset + returnedRows !== totalRows) {
    fail7("pagination_incomplete", "Cloud Run cursor does not match page coverage");
  }
  const rows = payload.rows.map((raw, index) => normalizedRow(raw, index, { from: expectedFrom, to: expectedTo }));
  const keys = rows.map(rowKey2);
  if (new Set(keys).size !== keys.length) fail7("duplicate_provider_row", "Cloud Run returned a duplicate hierarchy row");
  if (rows.some((row, index) => index > 0 && compareRows(rows[index - 1], row) > 0)) {
    fail7("provider_order_mismatch", "Cloud Run hierarchy page is not in canonical order");
  }
  const coverage = Object.freeze(Object.fromEntries(REQUIRED_LEVELS.map((level) => [
    level,
    Object.freeze({ complete: true, totalRows: payload.coverage[level].totalRows })
  ])));
  return Object.freeze({
    snapshotId,
    customer: Object.freeze({
      id: expectedCustomerId,
      currencyCode: currency2(payload.customer?.currencyCode, "payload.customer.currencyCode"),
      timeZone: timezone2(payload.customer?.timeZone, "payload.customer.timeZone"),
      manager: false
    }),
    range: Object.freeze({ from: expectedFrom, to: expectedTo }),
    coverage,
    page: Object.freeze({ offset, pageSize: expectedPageSize, returnedRows, totalRows, nextCursor }),
    rows: Object.freeze(rows)
  });
}
__name(validateGoogleAdsHierarchyPage, "validateGoogleAdsHierarchyPage");
var GOOGLE_ADS_CLOUDRUN_CONTRACT = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA,
  tool: READ_ONLY_TOOL,
  endpoint: DEFAULT_ENDPOINT,
  loginCustomerId: DEFAULT_MCC_CUSTOMER_ID,
  apiVersion: DEFAULT_API_VERSION2,
  levels: REQUIRED_LEVELS
});

// src/google-cloudrun-oidc-receiver.js
var GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
var GOOGLE_ISSUERS = Object.freeze(["https://accounts.google.com"]);
var GOOGLE_SIGNING_ALGORITHMS = Object.freeze(["RS256"]);
var RUNTIME_SERVICE_ACCOUNT = "toys-meta-buyer-runtime@toys-codex-media-buyer.iam.gserviceaccount.com";
var DEFAULT_MAX_BODY_BYTES = 1e6;
var MAX_BEARER_BYTES = 16384;
var MAX_TOKEN_LIFETIME_SECONDS = 3600;
var CLOCK_TOLERANCE_SECONDS = 5;
var remoteJwks;
var GoogleCloudRunOidcError = class extends Error {
  static {
    __name(this, "GoogleCloudRunOidcError");
  }
  constructor(code, status, message2 = code) {
    super(message2);
    this.name = "GoogleCloudRunOidcError";
    this.code = code;
    this.status = status;
  }
};
function fail8(code, status, message2 = code) {
  throw new GoogleCloudRunOidcError(code, status, message2);
}
__name(fail8, "fail");
function googleJwks() {
  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
      timeoutDuration: 5e3,
      cooldownDuration: 3e4,
      cacheMaxAge: 36e5
    });
  }
  return remoteJwks;
}
__name(googleJwks, "googleJwks");
function exactAudience(value2) {
  let audience;
  try {
    audience = new URL(String(value2 || ""));
  } catch (_) {
    fail8("oidc_not_configured", 503, "OIDC audience must be an absolute HTTPS URL");
  }
  if (audience.protocol !== "https:" || audience.username || audience.password || audience.search || audience.hash) {
    fail8("oidc_not_configured", 503, "OIDC audience must be an exact HTTPS receiver URL");
  }
  return audience.href;
}
__name(exactAudience, "exactAudience");
function expectedServiceAccount(value2) {
  const email = String(value2 || RUNTIME_SERVICE_ACCOUNT).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(email)) {
    fail8("oidc_not_configured", 503, "OIDC service account is invalid");
  }
  return email;
}
__name(expectedServiceAccount, "expectedServiceAccount");
function bearerToken(request) {
  const header = String(request.headers.get("authorization") || "");
  const match = header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) fail8("oidc_authentication_required", 401, "A Google OIDC bearer token is required");
  if (new TextEncoder().encode(match[1]).byteLength > MAX_BEARER_BYTES) {
    fail8("invalid_oidc_token", 401, "Google OIDC token is invalid");
  }
  return match[1];
}
__name(bearerToken, "bearerToken");
function bodyLimit(value2) {
  const limit = value2 == null ? DEFAULT_MAX_BODY_BYTES : Number(value2);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEFAULT_MAX_BODY_BYTES) {
    fail8("oidc_not_configured", 503, "OIDC receiver body limit is invalid");
  }
  return limit;
}
__name(bodyLimit, "bodyLimit");
function freshnessLimit(value2) {
  if (value2 == null) return null;
  const limit = Number(value2);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_TOKEN_LIFETIME_SECONDS) {
    fail8("oidc_not_configured", 503, "OIDC freshness limit is invalid");
  }
  return limit;
}
__name(freshnessLimit, "freshnessLimit");
async function readBoundedJson(request, maxBodyBytes) {
  const contentType = String(request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") fail8("unsupported_media_type", 415, "Receiver accepts application/json only");
  const contentEncoding = String(request.headers.get("content-encoding") || "").trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    fail8("unsupported_content_encoding", 415, "Compressed receiver bodies are not accepted");
  }
  const declaredLength = String(request.headers.get("content-length") || "").trim();
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBodyBytes) {
      fail8("request_body_too_large", 413, "Receiver body exceeds the configured limit");
    }
  }
  const reader = request.body?.getReader();
  if (!reader) fail8("invalid_json", 400, "Receiver body must be a JSON object");
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value: value2 } = await reader.read();
    if (done) break;
    total += value2.byteLength;
    if (total > maxBodyBytes) {
      try {
        await reader.cancel();
      } catch (_) {
      }
      fail8("request_body_too_large", 413, "Receiver body exceeds the configured limit");
    }
    chunks.push(value2);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (_) {
    fail8("invalid_json", 400, "Receiver body must contain valid UTF-8 JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail8("invalid_json_shape", 400, "Receiver body must be a JSON object");
  }
  return parsed;
}
__name(readBoundedJson, "readBoundedJson");
async function verifyGoogleCloudRunOidcToken({
  token,
  audience,
  serviceAccountEmail = RUNTIME_SERVICE_ACCOUNT,
  maxTokenAgeSeconds = null,
  verificationKey,
  currentDate
} = {}) {
  const expectedAudience = exactAudience(audience);
  const expectedEmail = expectedServiceAccount(serviceAccountEmail);
  const freshness = freshnessLimit(maxTokenAgeSeconds);
  const now = currentDate || /* @__PURE__ */ new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail8("oidc_not_configured", 503, "OIDC verification clock is invalid");
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, verificationKey || googleJwks(), {
      algorithms: [...GOOGLE_SIGNING_ALGORITHMS],
      issuer: [...GOOGLE_ISSUERS],
      audience: expectedAudience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now
    }));
  } catch (_) {
    fail8("invalid_oidc_token", 401, "Google OIDC token is invalid");
  }
  const tokenLifetimeSeconds = Number(payload.exp) - Number(payload.iat);
  const tokenAgeSeconds = Math.floor(now.getTime() / 1e3) - Number(payload.iat);
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || tokenLifetimeSeconds < 1 || tokenLifetimeSeconds > MAX_TOKEN_LIFETIME_SECONDS || tokenAgeSeconds < -CLOCK_TOLERANCE_SECONDS) {
    fail8("invalid_oidc_token", 401, "Google OIDC token is invalid");
  }
  if (freshness != null && tokenAgeSeconds > freshness + CLOCK_TOLERANCE_SECONDS) {
    fail8("stale_oidc_token", 401, "Google OIDC token is older than the receiver freshness policy");
  }
  const email = String(payload.email || "").trim().toLowerCase();
  if (payload.email_verified !== true || email !== expectedEmail) {
    fail8("oidc_principal_forbidden", 403, "Google OIDC principal is not approved");
  }
  if (!/^\d+$/.test(String(payload.sub || ""))) {
    fail8("invalid_oidc_token", 401, "Google OIDC token is invalid");
  }
  return Object.freeze({
    issuer: String(payload.iss),
    audience: expectedAudience,
    email,
    issuedAt: new Date(Number(payload.iat) * 1e3).toISOString(),
    expiresAt: new Date(Number(payload.exp) * 1e3).toISOString()
  });
}
__name(verifyGoogleCloudRunOidcToken, "verifyGoogleCloudRunOidcToken");
async function authenticateGoogleCloudRunPush(request, {
  audience,
  serviceAccountEmail = RUNTIME_SERVICE_ACCOUNT,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  maxTokenAgeSeconds = null,
  verificationKey,
  currentDate
} = {}) {
  if (!(request instanceof Request)) fail8("invalid_request", 400, "Receiver requires a Request");
  if (request.method !== "POST") fail8("method_not_allowed", 405, "Receiver accepts POST only");
  const expectedAudience = exactAudience(audience);
  const limit = bodyLimit(maxBodyBytes);
  if (new URL(request.url).href !== expectedAudience) {
    fail8("oidc_audience_route_mismatch", 403, "Receiver URL does not match its OIDC audience");
  }
  const token = bearerToken(request);
  const identity = await verifyGoogleCloudRunOidcToken({
    token,
    audience: expectedAudience,
    serviceAccountEmail,
    maxTokenAgeSeconds,
    verificationKey,
    currentDate
  });
  const unvalidatedJson = await readBoundedJson(request, limit);
  return Object.freeze({ identity, unvalidatedJson });
}
__name(authenticateGoogleCloudRunPush, "authenticateGoogleCloudRunPush");
var GOOGLE_CLOUDRUN_OIDC_RECEIVER_CONTRACT = Object.freeze({
  issuers: GOOGLE_ISSUERS,
  jwksUrl: GOOGLE_JWKS_URL,
  algorithms: GOOGLE_SIGNING_ALGORITHMS,
  runtimeServiceAccount: RUNTIME_SERVICE_ACCOUNT,
  method: "POST",
  contentType: "application/json",
  maxBodyBytes: DEFAULT_MAX_BODY_BYTES,
  tokenLifetime: Object.freeze({ maxSeconds: MAX_TOKEN_LIFETIME_SECONDS, clockToleranceSeconds: CLOCK_TOLERANCE_SECONDS }),
  freshness: Object.freeze({ defaultMaxAgeSeconds: null, policy: "optional_and_separate_from_jwt_lifetime" }),
  caching: "sender_may_reuse_a_valid_token_until_exp_and_must_refresh_by_exp",
  replayProtection: "payload_idempotency_required_before_persistence",
  payloadStatus: "unvalidated_until_server_contract_audit",
  oversizePolicy: "fail_closed_without_truncation",
  chunkingStatus: "pending_server_contract_audit"
});

// src/google-ads-cloudrun-receiver.js
async function receiveGoogleAdsHierarchyPage(request, {
  audience,
  expectedScope: expectedScope2,
  serviceAccountEmail = GOOGLE_CLOUDRUN_OIDC_RECEIVER_CONTRACT.runtimeServiceAccount,
  maxBodyBytes = GOOGLE_CLOUDRUN_OIDC_RECEIVER_CONTRACT.maxBodyBytes,
  maxTokenAgeSeconds = null,
  verificationKey,
  currentDate
} = {}) {
  const { identity, unvalidatedJson } = await authenticateGoogleCloudRunPush(request, {
    audience,
    serviceAccountEmail,
    maxBodyBytes,
    maxTokenAgeSeconds,
    verificationKey,
    currentDate
  });
  const scope = typeof expectedScope2 === "function" ? expectedScope2(unvalidatedJson) : expectedScope2;
  const payload = validateGoogleAdsHierarchyPage(unvalidatedJson, scope);
  return Object.freeze({
    identity,
    idempotencyKey: `${payload.snapshotId}:${payload.page.offset}`,
    payload
  });
}
__name(receiveGoogleAdsHierarchyPage, "receiveGoogleAdsHierarchyPage");
var GOOGLE_ADS_CLOUDRUN_RECEIVER_CONTRACT = Object.freeze({
  schemaVersion: GOOGLE_ADS_CLOUDRUN_CONTRACT.schemaVersion,
  runtimeServiceAccount: GOOGLE_CLOUDRUN_OIDC_RECEIVER_CONTRACT.runtimeServiceAccount,
  authentication: "google_oidc_rs256_exact_audience_and_service_account",
  validation: "strict_readonly_hierarchy_page",
  chunking: "one_verified_hierarchy_page_per_request",
  replayKey: "snapshotId:page.offset",
  persistence: "not_implemented"
});

// src/google-ads-cloudrun-ingestion.js
var GOOGLE_ADS_RECEIVER_URL = "https://toys-agency-platform-staging.denys-shpodaris.workers.dev/api/internal/google-ads/v1/pages";
var ORGANIZATION_ID3 = "org_toys_agency";
var PROJECTS = Object.freeze({
  "9632942627": Object.freeze({ id: "prj_amklinika_k8m2", slug: "amklinika-k8m2" }),
  "2662445825": Object.freeze({ id: "prj_karlovarska_sul_k4rm", slug: "karlovarska-sul-k4rm" })
});
var RESPONSE_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
});
function response4(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
}
__name(response4, "response");
function fail9(code, message2, status = 400) {
  const error = new Error(message2);
  error.code = code;
  error.status = status;
  throw error;
}
__name(fail9, "fail");
function expectedScope(raw) {
  const customerId = typeof raw?.customer?.id === "string" ? raw.customer.id : "";
  if (!PROJECTS[customerId]) {
    throw new GoogleAdsCloudRunError("account_not_allowlisted", "Google Ads customer is not allowlisted");
  }
  return {
    customerId,
    loginCustomerId: "7753894623",
    apiVersion: "v25",
    from: raw?.range?.from,
    to: raw?.range?.to,
    pageSize: raw?.page?.pageSize
  };
}
__name(expectedScope, "expectedScope");
async function sha2562(value2) {
  const bytes = new TextEncoder().encode(value2);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha2562, "sha256");
function rowKey3(row) {
  return [row.date, row.level, row.campaign.id, row.adGroup?.id || "", row.ad?.id || ""].join("");
}
__name(rowKey3, "rowKey");
function batchScope(payload, project) {
  return {
    projectId: project.id,
    customerId: payload.customer.id,
    rangeFrom: payload.range.from,
    rangeTo: payload.range.to,
    currencyCode: payload.customer.currencyCode,
    timeZone: payload.customer.timeZone,
    pageSize: payload.page.pageSize,
    totalRows: payload.page.totalRows,
    campaignRows: payload.coverage.campaign.totalRows,
    adGroupRows: payload.coverage.ad_group.totalRows,
    adRows: payload.coverage.ad.totalRows
  };
}
__name(batchScope, "batchScope");
function assertBatchScope(batch, payload, project) {
  const expected = batchScope(payload, project);
  for (const [field, value2] of Object.entries(expected)) {
    if (batch[field] !== value2) fail9("snapshot_scope_conflict", `Stored snapshot ${field} does not match the page`, 409);
  }
  if (batch.loginCustomerId !== "7753894623" || batch.apiVersion !== "v25") {
    fail9("snapshot_scope_conflict", "Stored snapshot provider scope is invalid", 409);
  }
  if (batch.status === "rejected") fail9("snapshot_rejected", "Snapshot was previously rejected", 409);
}
__name(assertBatchScope, "assertBatchScope");
async function readback(db, snapshotId) {
  const batch = await db.prepare(
    `SELECT snapshot_id AS snapshotId,project_id AS projectId,customer_id AS customerId,
            login_customer_id AS loginCustomerId,api_version AS apiVersion,range_from AS rangeFrom,
            range_to AS rangeTo,currency_code AS currencyCode,time_zone AS timeZone,page_size AS pageSize,
            total_rows AS totalRows,campaign_rows AS campaignRows,ad_group_rows AS adGroupRows,ad_rows AS adRows,
            next_expected_offset AS nextExpectedOffset,received_rows AS receivedRows,status,accepted_at AS acceptedAt
       FROM google_ads_receiver_batches WHERE snapshot_id=?`
  ).bind(snapshotId).first();
  if (!batch) fail9("snapshot_missing", "Snapshot readback is missing", 500);
  const levels = await db.prepare(
    `SELECT level,COUNT(*) AS rows FROM google_ads_receiver_rows
      WHERE snapshot_id=? GROUP BY level ORDER BY level`
  ).bind(snapshotId).all();
  const page2 = await db.prepare(
    `SELECT COUNT(*) AS pages,COALESCE(SUM(row_count),0) AS rows
       FROM google_ads_receiver_pages WHERE snapshot_id=?`
  ).bind(snapshotId).first();
  const levelRows = Object.fromEntries(["campaign", "ad_group", "ad"].map((level) => [level, 0]));
  for (const item of levels.results || []) levelRows[item.level] = Number(item.rows);
  return {
    batch,
    pages: Number(page2?.pages || 0),
    persistedRows: Number(page2?.rows || 0),
    levelRows
  };
}
__name(readback, "readback");
function safeAccepted(read, project) {
  return {
    accepted: read.batch.status === "accepted",
    status: read.batch.status,
    snapshotId: read.batch.snapshotId,
    projectSlug: project.slug,
    customerId: read.batch.customerId,
    range: { from: read.batch.rangeFrom, to: read.batch.rangeTo },
    currencyCode: read.batch.currencyCode,
    timeZone: read.batch.timeZone,
    totalRows: Number(read.batch.totalRows),
    persistedRows: read.persistedRows,
    levelRows: read.levelRows,
    pages: read.pages,
    nextExpectedOffset: Number(read.batch.nextExpectedOffset),
    acceptedAt: read.batch.acceptedAt || null,
    lastGoodChanged: false
  };
}
__name(safeAccepted, "safeAccepted");
async function persistPage(db, payload, project, pageHash, now) {
  let batch = await db.prepare(
    `SELECT project_id AS projectId,customer_id AS customerId,login_customer_id AS loginCustomerId,
            api_version AS apiVersion,range_from AS rangeFrom,range_to AS rangeTo,
            currency_code AS currencyCode,time_zone AS timeZone,page_size AS pageSize,total_rows AS totalRows,
            campaign_rows AS campaignRows,ad_group_rows AS adGroupRows,ad_rows AS adRows,
            next_expected_offset AS nextExpectedOffset,received_rows AS receivedRows,status
       FROM google_ads_receiver_batches WHERE snapshot_id=?`
  ).bind(payload.snapshotId).first();
  if (!batch) {
    if (payload.page.offset !== 0) fail9("pagination_incomplete", "The first delivered page must start at offset zero", 409);
    const scope = batchScope(payload, project);
    await db.prepare(
      `INSERT INTO google_ads_receiver_batches
        (snapshot_id,organization_id,project_id,customer_id,login_customer_id,api_version,
         range_from,range_to,currency_code,time_zone,page_size,total_rows,campaign_rows,
         ad_group_rows,ad_rows,next_expected_offset,received_rows,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'receiving',?,?)`
    ).bind(
      payload.snapshotId,
      ORGANIZATION_ID3,
      project.id,
      scope.customerId,
      "7753894623",
      "v25",
      scope.rangeFrom,
      scope.rangeTo,
      scope.currencyCode,
      scope.timeZone,
      scope.pageSize,
      scope.totalRows,
      scope.campaignRows,
      scope.adGroupRows,
      scope.adRows,
      0,
      0,
      now,
      now
    ).run();
    batch = await db.prepare(
      `SELECT project_id AS projectId,customer_id AS customerId,login_customer_id AS loginCustomerId,
              api_version AS apiVersion,range_from AS rangeFrom,range_to AS rangeTo,
              currency_code AS currencyCode,time_zone AS timeZone,page_size AS pageSize,total_rows AS totalRows,
              campaign_rows AS campaignRows,ad_group_rows AS adGroupRows,ad_rows AS adRows,
              next_expected_offset AS nextExpectedOffset,received_rows AS receivedRows,status
         FROM google_ads_receiver_batches WHERE snapshot_id=?`
    ).bind(payload.snapshotId).first();
  }
  assertBatchScope(batch, payload, project);
  const replay = await db.prepare(
    "SELECT page_hash AS pageHash FROM google_ads_receiver_pages WHERE snapshot_id=? AND page_offset=?"
  ).bind(payload.snapshotId, payload.page.offset).first();
  if (replay) {
    if (replay.pageHash !== pageHash) fail9("replay_conflict", "Page replay changed its authenticated payload", 409);
    return safeAccepted(await readback(db, payload.snapshotId), project);
  }
  if (batch.status === "accepted") fail9("snapshot_already_complete", "Accepted snapshot cannot receive another page", 409);
  if (Number(batch.nextExpectedOffset) !== payload.page.offset) {
    fail9("pagination_incomplete", "Delivered page offset is not contiguous", 409);
  }
  const statements = [db.prepare(
    `INSERT INTO google_ads_receiver_pages
      (snapshot_id,page_offset,page_hash,row_count,has_next,received_at) VALUES (?,?,?,?,?,?)`
  ).bind(payload.snapshotId, payload.page.offset, pageHash, payload.page.returnedRows, payload.page.nextCursor ? 1 : 0, now)];
  for (const row of payload.rows) {
    statements.push(db.prepare(
      `INSERT INTO google_ads_receiver_rows
        (snapshot_id,row_key,page_offset,level,metric_date,campaign_id,ad_group_id,ad_id,payload_json)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      payload.snapshotId,
      rowKey3(row),
      payload.page.offset,
      row.level,
      row.date,
      row.campaign.id,
      row.adGroup?.id || null,
      row.ad?.id || null,
      JSON.stringify(row)
    ));
  }
  statements.push(db.prepare(
    `UPDATE google_ads_receiver_batches
        SET next_expected_offset=?,received_rows=received_rows+?,updated_at=?
      WHERE snapshot_id=? AND status='receiving' AND next_expected_offset=?`
  ).bind(
    payload.page.offset + payload.page.returnedRows,
    payload.page.returnedRows,
    now,
    payload.snapshotId,
    payload.page.offset
  ));
  await db.batch(statements);
  let read = await readback(db, payload.snapshotId);
  if (!payload.page.nextCursor) {
    const expectedLevels = {
      campaign: Number(read.batch.campaignRows),
      ad_group: Number(read.batch.adGroupRows),
      ad: Number(read.batch.adRows)
    };
    const valid = read.persistedRows === Number(read.batch.totalRows) && Number(read.batch.receivedRows) === Number(read.batch.totalRows) && Number(read.batch.nextExpectedOffset) === Number(read.batch.totalRows) && Object.keys(expectedLevels).every((level) => read.levelRows[level] === expectedLevels[level]);
    if (!valid) {
      await db.prepare(
        `UPDATE google_ads_receiver_batches SET status='rejected',updated_at=? WHERE snapshot_id=? AND status='receiving'`
      ).bind(now, payload.snapshotId).run();
      fail9("readback_mismatch", "Persisted Google Ads snapshot failed exact readback", 409);
    }
    await db.prepare(
      `UPDATE google_ads_receiver_batches
          SET status='accepted',accepted_at=?,updated_at=?
        WHERE snapshot_id=? AND status='receiving'`
    ).bind(now, now, payload.snapshotId).run();
    read = await readback(db, payload.snapshotId);
  }
  return safeAccepted(read, project);
}
__name(persistPage, "persistPage");
async function handleGoogleAdsDelivery(request, env, {
  audience = GOOGLE_ADS_RECEIVER_URL,
  verificationKey,
  currentDate,
  now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now")
} = {}) {
  try {
    if (String(env?.ENVIRONMENT || "") !== "staging") fail9("receiver_disabled", "Google Ads receiver is staging-only", 404);
    if (!env?.TOYS_DB || typeof env.TOYS_DB.prepare !== "function" || typeof env.TOYS_DB.batch !== "function") {
      fail9("database_unavailable", "Google Ads receiver database is unavailable", 503);
    }
    const received = await receiveGoogleAdsHierarchyPage(request, {
      audience,
      expectedScope,
      verificationKey,
      currentDate,
      maxTokenAgeSeconds: 900
    });
    const project = PROJECTS[received.payload.customer.id];
    const pageHash = await sha2562(JSON.stringify({
      snapshotId: received.payload.snapshotId,
      coverage: received.payload.coverage,
      page: received.payload.page,
      rows: received.payload.rows
    }));
    const result = await persistPage(env.TOYS_DB, received.payload, project, pageHash, now().toISOString());
    return response4({ ok: true, ...result }, result.accepted ? 200 : 202);
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "receiver_error";
    const status = Number.isInteger(error?.status) ? error.status : code === "account_not_allowlisted" ? 403 : code.includes("pagination") || code.includes("replay") ? 409 : 400;
    return response4({ ok: false, error: code }, status);
  }
}
__name(handleGoogleAdsDelivery, "handleGoogleAdsDelivery");
var GOOGLE_ADS_INGESTION_CONTRACT = Object.freeze({
  audience: GOOGLE_ADS_RECEIVER_URL,
  organizationId: ORGANIZATION_ID3,
  customers: Object.freeze(Object.fromEntries(Object.entries(PROJECTS).map(([id, project]) => [id, project.slug]))),
  loginCustomerId: "7753894623",
  apiVersion: "v25",
  persistence: "quarantined_receiver_tables_only",
  lastGoodMutation: false
});

// src/index.js
var JSON_HEADERS4 = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS4, ...extraHeaders }
  });
}
__name(json, "json");
function requestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}
__name(requestId, "requestId");
function internalAuthorized(request, env) {
  const expected = String(env.TOYS_INTERNAL_TOKEN || "");
  const supplied = request.headers.get("x-toys-internal-token") || "";
  return expected.length >= 32 && supplied === expected;
}
__name(internalAuthorized, "internalAuthorized");
async function databaseHealth(env) {
  if (!env.TOYS_DB || typeof env.TOYS_DB.prepare !== "function") {
    return { ok: false, error: "database binding is missing" };
  }
  try {
    const row = await env.TOYS_DB.prepare("SELECT 1 AS ok").first();
    return { ok: Number(row?.ok) === 1 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "database query failed" };
  }
}
__name(databaseHealth, "databaseHealth");
async function listProjects(env) {
  const result = await env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, status
       FROM projects
      WHERE status IN ('active', 'draft')
      ORDER BY name COLLATE NOCASE`
  ).all();
  return result.results || [];
}
__name(listProjects, "listProjects");
function validDate3(value2) {
  const text4 = String(value2 || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text4)) return false;
  const parsed = /* @__PURE__ */ new Date(`${text4}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text4;
}
__name(validDate3, "validDate");
var HOUSEVIP_STATUSES = [
  "\u041D\u043E\u0432\u044B\u0439",
  "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F",
  "\u0421\u0432\u044F\u0437\u0430\u043B\u0438\u0441\u044C",
  "\u041A\u0432\u0430\u043B\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D",
  "\u041F\u043E\u0434\u0431\u043E\u0440 \u043E\u0431\u044A\u0435\u043A\u0442\u0430",
  "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D",
  "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u043D",
  "\u041F\u0435\u0440\u0435\u0433\u043E\u0432\u043E\u0440\u044B",
  "\u0411\u0440\u043E\u043D\u044C / \u0437\u0430\u0434\u0430\u0442\u043E\u043A",
  "\u0421\u0434\u0435\u043B\u043A\u0430",
  "\u041E\u0442\u043B\u043E\u0436\u0435\u043D",
  "\u041D\u0435\u0430\u043A\u0442\u0443\u0430\u043B\u0435\u043D"
];
function projectLeadStatuses(project) {
  try {
    const values = JSON.parse(project?.settingsJson || "{}")?.leadStatuses;
    if (Array.isArray(values)) {
      const statuses = values.map((value2) => String(value2 || "").trim()).filter(Boolean);
      if (statuses.length) return statuses;
    }
  } catch (_) {
  }
  return HOUSEVIP_STATUSES;
}
__name(projectLeadStatuses, "projectLeadStatuses");
async function activeProject(env, slug2) {
  return env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, currency, settings_json AS settingsJson
       FROM projects WHERE slug = ? AND status = 'active'`
  ).bind(slug2).first();
}
__name(activeProject, "activeProject");
function sameOriginWrite(request) {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}
__name(sameOriginWrite, "sameOriginWrite");
function gvizTable(labels, rows) {
  return {
    version: "0.6",
    status: "ok",
    table: {
      cols: labels.map((label, index) => ({ id: String.fromCharCode(65 + index), label, type: index === 0 ? "date" : "string" })),
      rows: rows.map((row) => ({ c: row.map((value2) => value2 == null ? null : { v: value2 }) }))
    }
  };
}
__name(gvizTable, "gvizTable");
function gvizDate2(value2) {
  const match = String(value2 || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `Date(${Number(match[1])},${Number(match[2]) - 1},${Number(match[3])})` : String(value2 || "");
}
__name(gvizDate2, "gvizDate");
async function adsTab(env, project, tab) {
  const labels = ["date", "platform", "account_name", "account_id", "currency", "campaign", "impressions", "clicks", "cost", "conversions", "conv_value"];
  if (tab !== "MetaAds" && tab !== "GoogleAds") return null;
  const provider = tab === "MetaAds" ? "meta_ads" : "google_ads";
  const integration = await env.TOYS_DB.prepare(
    `SELECT external_account_id AS accountId FROM integrations
      WHERE project_id = ? AND provider = ? ORDER BY updated_at DESC LIMIT 1`
  ).bind(project.id, provider).first();
  const result = await env.TOYS_DB.prepare(
    `SELECT m.metric_date AS metricDate, m.currency, COALESCE(c.name, m.external_campaign_id) AS campaign,
            m.impressions, m.clicks, m.spend, m.conversions, m.revenue
       FROM ad_metrics_daily m
       LEFT JOIN campaigns c ON c.project_id = m.project_id AND c.provider = m.provider
                            AND c.external_campaign_id = m.external_campaign_id
      WHERE m.project_id = ? AND m.provider = ? ORDER BY m.metric_date, campaign`
  ).bind(project.id, provider).all();
  return gvizTable(labels, (result.results || []).map((row) => [
    gvizDate2(row.metricDate),
    tab === "MetaAds" ? "Meta Ads" : "Google Ads",
    project.name,
    provider === "meta_ads" ? `act_${integration?.accountId || ""}` : integration?.accountId || "",
    row.currency,
    row.campaign,
    Number(row.impressions || 0),
    Number(row.clicks || 0),
    Number(row.spend || 0),
    Number(row.conversions || 0),
    Number(row.revenue || 0)
  ]));
}
__name(adsTab, "adsTab");
async function weeklyTab(env, project) {
  const result = await env.TOYS_DB.prepare(
    `SELECT id, period_start AS periodStart, period_end AS periodEnd, summary, wins, issues,
            changes, next_steps AS nextSteps, status
       FROM weekly_reports WHERE project_id = ? ORDER BY period_end DESC`
  ).bind(project.id).all();
  return gvizTable(
    ["id", "period_start", "period_end", "summary", "wins", "issues", "changes", "next_steps", "status"],
    (result.results || []).map((row) => [row.id, row.periodStart, row.periodEnd, row.summary, row.wins, row.issues, row.changes, row.nextSteps, row.status])
  );
}
__name(weeklyTab, "weeklyTab");
async function publicTab(env, slug2, tab, raw) {
  const project = await activeProject(env, slug2);
  if (!project) return null;
  const ads = await adsTab(env, project, tab);
  if (ads) return ads;
  if (["Insights", "MetaAdsFormat", "EcomFunnel", "EcomFunnelCampaign"].includes(tab)) return gvizTable([], []);
  if (tab === "WeeklyComments") return weeklyTab(env, project);
  const row = await env.TOYS_DB.prepare(
    `SELECT content_json AS contentJson, raw_content_json AS rawContentJson
       FROM project_tabs WHERE project_id = ? AND source_title = ? LIMIT 1`
  ).bind(project.id, tab).first();
  if (!row) return gvizTable([], []);
  try {
    return JSON.parse(raw && row.rawContentJson ? row.rawContentJson : row.contentJson);
  } catch (_) {
    return gvizTable([], []);
  }
}
__name(publicTab, "publicTab");
async function publicLeads(env, slug2) {
  const project = await activeProject(env, slug2);
  if (!project) return null;
  const result = await env.TOYS_DB.prepare(
    `SELECT l.id, l.created_at AS date, l.name, l.phone, l.email, l.source_provider AS sourceProvider,
            l.contact_method AS contactMethod, l.budget, l.current_status AS status,
            l.status_updated_at AS statusUpdatedAt, l.updated_at AS updatedAt,
            json_extract(l.metadata_json, '$.service') AS service,
            json_extract(l.metadata_json, '$.description') AS description,
            json_extract(l.metadata_json, '$.language') AS language,
            json_extract(l.metadata_json, '$.page') AS page,
            json_extract(l.metadata_json, '$.campaign') AS campaign,
            json_extract(l.metadata_json, '$.adset') AS adset,
            json_extract(l.metadata_json, '$.ad') AS ad,
            COALESCE(json_extract(l.metadata_json, '$.isTest'), 0) AS isTest,
            COALESCE((SELECT body FROM lead_comments c WHERE c.lead_id = l.id
                       ORDER BY c.updated_at DESC, c.created_at DESC LIMIT 1), '') AS comment
       FROM leads l WHERE l.project_id = ? AND COALESCE(json_extract(l.metadata_json, '$.isTest'), 0) = 0
       ORDER BY l.created_at DESC, l.id`
  ).bind(project.id).all();
  return { title: project.name, statuses: projectLeadStatuses(project), leads: result.results || [] };
}
__name(publicLeads, "publicLeads");
async function publicExchangeRate(env, slug2, base, quote) {
  const project = await activeProject(env, slug2);
  if (!project) return null;
  return env.TOYS_DB.prepare(
    `SELECT rate_date AS date, base_currency AS base, quote_currency AS quote, rate, source
       FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? ORDER BY rate_date DESC LIMIT 1`
  ).bind(base, quote).first();
}
__name(publicExchangeRate, "publicExchangeRate");
async function publicDashboard(env, slug2, from, to) {
  const project = await env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, currency, settings_json AS settingsJson
       FROM projects
      WHERE slug = ? AND status = 'active'`
  ).bind(slug2).first();
  if (!project) return null;
  let settings = {};
  try {
    settings = JSON.parse(project.settingsJson || "{}");
  } catch (_) {
  }
  delete project.settingsJson;
  const bounds = await env.TOYS_DB.prepare(
    `SELECT MIN(metric_date) AS minDate, MAX(metric_date) AS maxDate
       FROM ad_metrics_daily
      WHERE project_id = ?`
  ).bind(project.id).first();
  const start = validDate3(from) ? from : bounds?.minDate;
  const end = validDate3(to) ? to : bounds?.maxDate;
  if (!start || !end || start > end) {
    return { project: { ...project, settings }, range: { from: start || null, to: end || null }, totals: null, daily: [], campaigns: [] };
  }
  const params = [project.id, start, end];
  const totals = await env.TOYS_DB.prepare(
    `SELECT COALESCE(SUM(impressions), 0) AS impressions,
            COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(spend), 0) AS spend,
            COALESCE(SUM(leads), 0) AS leads
       FROM ad_metrics_daily
      WHERE project_id = ? AND metric_date BETWEEN ? AND ?`
  ).bind(...params).first();
  const dailyResult = await env.TOYS_DB.prepare(
    `SELECT metric_date AS date, currency,
            SUM(impressions) AS impressions, SUM(clicks) AS clicks,
            SUM(spend) AS spend, SUM(leads) AS leads
       FROM ad_metrics_daily
      WHERE project_id = ? AND metric_date BETWEEN ? AND ?
      GROUP BY metric_date, currency
      ORDER BY metric_date`
  ).bind(...params).all();
  const campaignsResult = await env.TOYS_DB.prepare(
    `SELECT m.provider, m.external_campaign_id AS externalCampaignId,
            COALESCE(c.name, m.external_campaign_id) AS name, m.currency,
            SUM(m.impressions) AS impressions, SUM(m.clicks) AS clicks,
            SUM(m.spend) AS spend, SUM(m.leads) AS leads
       FROM ad_metrics_daily m
       LEFT JOIN campaigns c
         ON c.project_id = m.project_id
        AND c.provider = m.provider
        AND c.external_campaign_id = m.external_campaign_id
      WHERE m.project_id = ? AND m.metric_date BETWEEN ? AND ?
      GROUP BY m.provider, m.external_campaign_id, c.name, m.currency
      ORDER BY spend DESC`
  ).bind(...params).all();
  const impressions = Number(totals?.impressions || 0);
  const clicks = Number(totals?.clicks || 0);
  const spend = Number(totals?.spend || 0);
  const leads = Number(totals?.leads || 0);
  return {
    project: { ...project, settings },
    range: { from: start, to: end },
    totals: {
      impressions,
      clicks,
      spend,
      leads,
      ctr: impressions ? clicks / impressions * 100 : 0,
      cpl: leads ? spend / leads : null
    },
    daily: dailyResult.results || [],
    campaigns: campaignsResult.results || []
  };
}
__name(publicDashboard, "publicDashboard");
async function handleApi(request, env) {
  const url = new URL(request.url);
  const id = requestId(request);
  if (url.href === GOOGLE_ADS_RECEIVER_URL) {
    return handleGoogleAdsDelivery(request, env);
  }
  if (url.pathname.startsWith("/api/v2/")) {
    return handleMvpApi(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    const database = await databaseHealth(env);
    return json(
      {
        ok: database.ok,
        service: env.APP_NAME || "TOYS Agency Platform",
        environment: env.ENVIRONMENT || "unknown",
        database,
        requestId: id
      },
      database.ok ? 200 : 503
    );
  }
  if (request.method === "GET" && url.pathname === "/api/internal/real-commerce-source-preflight" && String(env.REAL_COMMERCE_PREFLIGHT_ENABLED || "").toLowerCase() === "true") {
    try {
      return json({ ...await preflightRealCommerceSources(env), requestId: id });
    } catch (error) {
      return json({
        ok: false,
        error: typeof error?.code === "string" ? error.code : "source_preflight_failed",
        message: error instanceof Error ? error.message : "source preflight failed",
        details: error?.details || null,
        requestId: id
      }, 503);
    }
  }
  if (/^\/api\/public\/projects\/[a-z0-9-]+(?:\/|$)/.test(url.pathname)) {
    const error = url.pathname.includes("/leads") ? "pii_endpoint_disabled" : "legacy_public_api_disabled";
    return json({ ok: false, error, requestId: id }, 410);
  }
  const publicMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/dashboard$/);
  if (request.method === "GET" && publicMatch) {
    try {
      const dashboard2 = await publicDashboard(
        env,
        publicMatch[1],
        url.searchParams.get("from"),
        url.searchParams.get("to")
      );
      if (!dashboard2) return json({ ok: false, error: "not_found", requestId: id }, 404);
      return json({ ok: true, dashboard: dashboard2, requestId: id }, 200, { "cache-control": "public, max-age=60" });
    } catch (error) {
      return json(
        { ok: false, error: "database_error", message: error instanceof Error ? error.message : "query failed", requestId: id },
        500
      );
    }
  }
  const tabMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/data\/tabs$/);
  if (request.method === "GET" && tabMatch) {
    try {
      const table3 = await publicTab(env, tabMatch[1], url.searchParams.get("tab") || "", url.searchParams.get("raw") === "1");
      if (!table3) return json({ ok: false, error: "not_found", requestId: id }, 404);
      return json(table3, 200, { "cache-control": "public, max-age=60" });
    } catch (error) {
      return json({ ok: false, error: "database_error", message: error instanceof Error ? error.message : "query failed", requestId: id }, 500);
    }
  }
  const leadsMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/leads$/);
  if (request.method === "GET" && leadsMatch) {
    return json({ ok: false, error: "pii_endpoint_disabled", requestId: id }, 410);
  }
  const leadMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/leads\/([a-f0-9-]+)$/);
  if (request.method === "POST" && leadMatch) {
    return json({ ok: false, error: "pii_endpoint_disabled", requestId: id }, 410);
  }
  const weeklyMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/weekly-reports$/);
  if (request.method === "POST" && weeklyMatch) {
    return json({ ok: false, error: "legacy_write_disabled", requestId: id }, 410);
  }
  const rateMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/exchange-rate$/);
  if (request.method === "GET" && rateMatch) {
    try {
      const base = String(url.searchParams.get("base") || "").toUpperCase();
      const quote = String(url.searchParams.get("quote") || "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return json({ ok: false, error: "invalid_currency", requestId: id }, 400);
      const rate = await publicExchangeRate(env, rateMatch[1], base, quote);
      if (!rate) return json({ ok: false, error: "not_found", requestId: id }, 404);
      return json({ ok: true, rate, requestId: id }, 200, { "cache-control": "public, max-age=3600" });
    } catch (error) {
      return json({ ok: false, error: "database_error", message: error instanceof Error ? error.message : "query failed", requestId: id }, 500);
    }
  }
  if (!url.pathname.startsWith("/api/internal/")) {
    return json({ ok: false, error: "not_found", requestId: id }, 404);
  }
  if (!internalAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized", requestId: id }, 401);
  }
  if (request.method === "GET" && url.pathname === "/api/internal/projects") {
    try {
      return json({ ok: true, projects: await listProjects(env), requestId: id });
    } catch (error) {
      return json(
        {
          ok: false,
          error: "database_error",
          message: error instanceof Error ? error.message : "query failed",
          requestId: id
        },
        500
      );
    }
  }
  return json({ ok: false, error: "not_found", requestId: id }, 404);
}
__name(handleApi, "handleApi");
async function recordScheduledRun(env) {
  if (!env.TOYS_DB || typeof env.TOYS_DB.prepare !== "function") return;
  return env.TOYS_DB.prepare(
    `INSERT INTO sync_runs
      (project_id, provider, job_type, status, started_at, finished_at, rows_read, rows_written, message)
     SELECT id, 'system', 'daily-scheduler', 'skipped', datetime('now'), datetime('now'), 0, 0,
            CASE WHEN id = 'prj_housevip_cxp7'
              THEN 'HOUSEVIP is fully stored in D1; direct Meta sync awaits account authorization.'
              ELSE 'Provider sync is not connected yet.' END
       FROM projects
      WHERE status = 'active'`
  ).run();
}
__name(recordScheduledRun, "recordScheduledRun");
async function scheduledHousevipSync(env, runner = syncHousevip) {
  const enabled = String(env.HOUSEVIP_SYNC_ENABLED || "").toLowerCase() === "true";
  if (String(env.ENVIRONMENT || "") !== "staging" || !enabled) {
    await recordScheduledRun(env);
    return { ok: true, status: "disabled" };
  }
  return runner(env);
}
__name(scheduledHousevipSync, "scheduledHousevipSync");
async function scheduledRealCommerceSync(env, runner = syncRealCommerceProjects) {
  const enabled = String(env.REAL_COMMERCE_SYNC_ENABLED || "").toLowerCase() === "true";
  if (String(env.ENVIRONMENT || "") !== "staging" || !enabled) {
    return { ok: true, status: "disabled" };
  }
  return runner(env);
}
__name(scheduledRealCommerceSync, "scheduledRealCommerceSync");
async function scheduledPilotSyncs(env, {
  housevipRunner = syncHousevip,
  realCommerceRunner = syncRealCommerceProjects
} = {}) {
  const results = {};
  try {
    results.housevip = await scheduledHousevipSync(env, housevipRunner);
  } catch (error) {
    results.housevip = { ok: false, error: typeof error?.code === "string" ? error.code : "sync_failed" };
  }
  try {
    results.realCommerce = await scheduledRealCommerceSync(env, realCommerceRunner);
  } catch (error) {
    results.realCommerce = { ok: false, error: typeof error?.code === "string" ? error.code : "sync_failed" };
  }
  return results;
}
__name(scheduledPilotSyncs, "scheduledPilotSyncs");
async function refreshIdrEurRate(env) {
  if (!env.TOYS_DB) return;
  try {
    const response5 = await fetch("https://latest.currency-api.pages.dev/v1/currencies/idr.json");
    if (!response5.ok) throw new Error(`FX HTTP ${response5.status}`);
    const data = await response5.json();
    const rate = Number(data?.idr?.eur), date2 = String(data?.date || "");
    if (!(rate > 0) || !validDate3(date2)) throw new Error("invalid FX response");
    await env.TOYS_DB.prepare(
      `INSERT INTO exchange_rates (rate_date, base_currency, quote_currency, rate, source)
       VALUES (?, 'IDR', 'EUR', ?, 'currency-api-pages')
       ON CONFLICT(rate_date, base_currency, quote_currency) DO UPDATE SET rate=excluded.rate, fetched_at=datetime('now')`
    ).bind(date2, rate).run();
  } catch (error) {
    await env.TOYS_DB.prepare(
      `INSERT INTO sync_runs (project_id, provider, job_type, status, started_at, finished_at, message)
       VALUES ('prj_housevip_cxp7', 'currency', 'daily-fx', 'warning', datetime('now'), datetime('now'), ?)`
    ).bind(error instanceof Error ? error.message : "FX refresh failed").run();
  }
}
__name(refreshIdrEurRate, "refreshIdrEurRate");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(request);
    return new Response("TOYS Agency Platform", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  },
  async scheduled(_event, env, controller) {
    controller.waitUntil(scheduledPilotSyncs(env));
    controller.waitUntil(refreshIdrEurRate(env));
  }
};

// src/ads-readonly-preflight.js
var META_API_VERSION = "v26.0";
var MAX_SOURCE_BYTES3 = 4e6;
var MAX_META_PAGES = 20;
var MAX_ACTION_TYPES = 250;
var PILOT_SLUGS = Object.freeze([
  "profkit-instashop-r4vk",
  "housevip-cxp7",
  "karlovarska-sul-k4rm"
]);
var PROFKIT_DIRECT_PRIORITY = Object.freeze([
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply"
]);
var AdsReadOnlyPreflightError = class extends Error {
  static {
    __name(this, "AdsReadOnlyPreflightError");
  }
  constructor(code, message2 = code, details = null) {
    super(message2);
    this.name = "AdsReadOnlyPreflightError";
    this.code = code;
    this.details = details;
  }
};
function fail10(code, message2, details = null) {
  throw new AdsReadOnlyPreflightError(code, message2, details);
}
__name(fail10, "fail");
function norm2(value2) {
  return String(value2 ?? "").trim();
}
__name(norm2, "norm");
function normalizedAccountId2(value2) {
  const accountId2 = norm2(value2).replace(/^act_/i, "");
  if (!/^\d+$/.test(accountId2)) fail10("source_account_invalid", "pilot source contains an invalid Meta account");
  return accountId2;
}
__name(normalizedAccountId2, "normalizedAccountId");
function validTimezone(value2) {
  const timezone3 = norm2(value2);
  if (!timezone3) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone3 }).format(/* @__PURE__ */ new Date(0));
  } catch (_) {
    return null;
  }
  return timezone3;
}
__name(validTimezone, "validTimezone");
function completedLocalDate(now, timezone3) {
  const date2 = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date2.getTime())) fail10("invalid_clock", "preflight clock is invalid");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone3,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date2).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localToday = /* @__PURE__ */ new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  localToday.setUTCDate(localToday.getUTCDate() - 1);
  return localToday.toISOString().slice(0, 10);
}
__name(completedLocalDate, "completedLocalDate");
function sourceSpec(projectSlug) {
  if (projectSlug === "housevip-cxp7") {
    return {
      key: "housevip_meta",
      url: HOUSEVIP_METAADS_SOURCE.url,
      reportingTimezone: HOUSEVIP_METAADS_SOURCE.sourceTimezone,
      providerCurrencyOverride: null
    };
  }
  const config = REAL_COMMERCE_GVIZ_SOURCES[projectSlug];
  const spec = config?.tables?.find((item) => item.key === (projectSlug === "profkit-instashop-r4vk" ? "profkit_meta" : "karl_meta"));
  if (!spec) fail10("project_not_allowlisted", "pilot project is not allowlisted for Ads preflight");
  const query = new URLSearchParams({ tqx: "out:json", headers: String(spec.headers), gid: String(spec.gid) });
  return {
    key: spec.key,
    url: `https://docs.google.com/spreadsheets/d/${spec.spreadsheetId}/gviz/tq?${query}`,
    reportingTimezone: projectSlug === "profkit-instashop-r4vk" ? "America/Los_Angeles" : "Asia/Tbilisi",
    providerCurrencyOverride: projectSlug === "profkit-instashop-r4vk" ? "USD" : null
  };
}
__name(sourceSpec, "sourceSpec");
async function sourceText(fetchImpl, spec) {
  let response5;
  try {
    response5 = await fetchImpl(spec.url, { method: "GET", headers: { accept: "application/json,text/plain;q=0.9" } });
  } catch (_) {
    fail10("source_unavailable", "pilot MetaAds source request failed");
  }
  if (!response5?.ok) fail10("source_http_error", "pilot MetaAds source returned an error", { status: Number(response5?.status || 0) });
  const declared = Number(response5.headers?.get?.("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES3) fail10("source_too_large", "pilot MetaAds source exceeds the safety limit");
  const text4 = await response5.text();
  if (new TextEncoder().encode(text4).byteLength > MAX_SOURCE_BYTES3) fail10("source_too_large", "pilot MetaAds source exceeds the safety limit");
  return { text: text4, httpStatus: Number(response5.status) };
}
__name(sourceText, "sourceText");
async function resolveSourceIdentity(projectSlug, fetchImpl) {
  if (!PILOT_SLUGS.includes(projectSlug)) fail10("project_not_allowlisted", "pilot project is not allowlisted for Ads preflight");
  const spec = sourceSpec(projectSlug);
  const source = await sourceText(fetchImpl, spec);
  const values = parseGvizTable(source.text, { key: spec.key, headers: 1 });
  const header = (values[0] || []).map(norm2);
  const required = ["date", "platform", "account_name", "account_id", "currency", "campaign"];
  required.forEach((name, index) => {
    if (header[index] !== name) fail10("source_schema_mismatch", `pilot MetaAds column ${index + 1} must be ${name}`);
  });
  const accountIndex = header.indexOf("account_id");
  const currencyIndex = header.indexOf("currency");
  const platformIndex = header.indexOf("platform");
  const rows = values.slice(1).filter((row) => row.some((value2) => norm2(value2)));
  const metaRows = rows.filter((row) => norm2(row[platformIndex]).toLowerCase() === "meta ads");
  if (!metaRows.length) fail10("source_empty", "pilot MetaAds source contains no Meta advertising rows");
  const accountIds = [...new Set(metaRows.map((row) => normalizedAccountId2(row[accountIndex])))];
  const reportingCurrencies = [...new Set(metaRows.map((row) => norm2(row[currencyIndex]).toUpperCase()).filter(Boolean))];
  if (accountIds.length !== 1) fail10("source_account_ambiguous", "pilot MetaAds source must contain exactly one account");
  if (reportingCurrencies.length !== 1 || !/^[A-Z]{3}$/.test(reportingCurrencies[0])) {
    fail10("source_currency_ambiguous", "pilot MetaAds source must contain exactly one currency");
  }
  return {
    accountId: accountIds[0],
    reportingCurrency: reportingCurrencies[0],
    expectedProviderCurrency: spec.providerCurrencyOverride || reportingCurrencies[0],
    reportingTimezone: spec.reportingTimezone,
    sourceHttpStatus: source.httpStatus,
    sourceRowCount: metaRows.length
  };
}
__name(resolveSourceIdentity, "resolveSourceIdentity");
async function appSecretProof(accessToken, appSecret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(appSecretProof, "appSecretProof");
async function metaJson(fetchImpl, url, accessToken) {
  let response5;
  try {
    response5 = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` }
    });
  } catch (_) {
    fail10("meta_unavailable", "Meta request failed");
  }
  if (!response5?.ok) {
    let providerCode = null;
    try {
      providerCode = Number((await response5.json())?.error?.code) || null;
    } catch (_) {
    }
    fail10(response5.status === 429 ? "meta_rate_limited" : [401, 403].includes(response5.status) ? "meta_unauthorized" : "meta_http_error", "Meta returned an error", {
      status: Number(response5.status || 0),
      providerCode
    });
  }
  try {
    return { body: await response5.json(), status: Number(response5.status) };
  } catch (_) {
    fail10("meta_invalid_json", "Meta returned invalid JSON");
  }
}
__name(metaJson, "metaJson");
function collectActionTypes(target, raw, field) {
  if (raw == null) return;
  if (!Array.isArray(raw)) fail10("meta_schema_mismatch", `${field} must be an array`);
  for (const item of raw) {
    const actionType = norm2(item?.action_type);
    if (!actionType) fail10("meta_schema_mismatch", `${field} contains a blank action_type`);
    target.add(actionType);
    if (target.size > MAX_ACTION_TYPES) fail10("meta_schema_mismatch", "Meta returned too many distinct action types");
  }
}
__name(collectActionTypes, "collectActionTypes");
async function loadMetaDay(fetchImpl, source, metadata, localDate, accessToken, proof) {
  const endpoint = `https://graph.facebook.com/${META_API_VERSION}/act_${source.accountId}/insights`;
  const params = new URLSearchParams({
    fields: "account_id,account_currency,campaign_id,date_start,date_stop,impressions,clicks,spend,actions,action_values",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: localDate, until: localDate }),
    action_report_time: "conversion",
    use_account_attribution_setting: "true",
    appsecret_proof: proof,
    limit: "500"
  });
  const actionTypes = /* @__PURE__ */ new Set(), actionValueTypes = /* @__PURE__ */ new Set(), campaignKeys = /* @__PURE__ */ new Set(), statuses = [];
  let nextUrl = new URL(`${endpoint}?${params}`), pageCount = 0, rowCount = 0;
  while (nextUrl) {
    pageCount += 1;
    if (pageCount > MAX_META_PAGES) fail10("meta_pagination_limit", "Meta pagination exceeded the safety limit");
    const page2 = await metaJson(fetchImpl, nextUrl, accessToken);
    statuses.push(page2.status);
    if (!Array.isArray(page2.body?.data)) fail10("meta_schema_mismatch", "Meta insights data must be an array");
    for (const [index, row] of page2.body.data.entries()) {
      if (normalizedAccountId2(row?.account_id) !== source.accountId) fail10("meta_account_mismatch", "Meta insights escaped the allowlisted account");
      if (norm2(row?.account_currency).toUpperCase() !== metadata.currency) fail10("meta_currency_mismatch", "Meta insights currency changed within the response");
      if (norm2(row?.date_start) !== localDate || norm2(row?.date_stop) !== localDate) fail10("meta_date_mismatch", "Meta insights escaped the completed local day");
      const campaignId = norm2(row?.campaign_id);
      if (!/^\d+$/.test(campaignId)) fail10("meta_schema_mismatch", `Meta insights row ${index + 1} has an invalid campaign`);
      if (campaignKeys.has(campaignId)) fail10("meta_duplicate_row", "Meta returned a duplicate campaign-day row");
      campaignKeys.add(campaignId);
      collectActionTypes(actionTypes, row?.actions, "actions");
      collectActionTypes(actionValueTypes, row?.action_values, "action_values");
      rowCount += 1;
    }
    const rawNext = norm2(page2.body?.paging?.next);
    if (!rawNext) {
      nextUrl = null;
      continue;
    }
    let parsed;
    try {
      parsed = new URL(rawNext);
    } catch (_) {
      fail10("meta_pagination_invalid", "Meta returned an invalid next page");
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "graph.facebook.com" || parsed.pathname !== new URL(endpoint).pathname) {
      fail10("meta_pagination_scope", "Meta pagination escaped the allowlisted endpoint");
    }
    parsed.searchParams.delete("access_token");
    if (!parsed.searchParams.has("appsecret_proof")) parsed.searchParams.set("appsecret_proof", proof);
    nextUrl = parsed;
  }
  const sortedActions = [...actionTypes].sort();
  const sortedValues = [...actionValueTypes].sort();
  return {
    localDate,
    pageCount,
    rowCount,
    pageHttpStatuses: statuses,
    paginationComplete: true,
    campaignDayKeysUnique: true,
    actionTypes: sortedActions,
    actionValueTypes: sortedValues
  };
}
__name(loadMetaDay, "loadMetaDay");
function mappingSummary(projectSlug, day) {
  if (projectSlug === "profkit-instashop-r4vk") {
    return {
      status: "verified",
      mode: "first_present",
      actionTypes: [...PROFKIT_DIRECT_PRIORITY],
      presentActionTypes: PROFKIT_DIRECT_PRIORITY.filter((actionType) => day.actionTypes.includes(actionType))
    };
  }
  return {
    status: "blocked_exact_mapping",
    inventoryOnly: true
  };
}
__name(mappingSummary, "mappingSummary");
async function runAdsReadOnlyPreflight({
  projectSlug,
  env,
  fetchImpl = fetch,
  now = /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "now")
} = {}) {
  const slug2 = norm2(projectSlug);
  if (!PILOT_SLUGS.includes(slug2)) fail10("project_not_allowlisted", "pilot project is not allowlisted for Ads preflight");
  const accessToken = norm2(env?.META_ADS_ACCESS_TOKEN);
  const appSecret = norm2(env?.META_APP_SECRET);
  if (!accessToken || !appSecret) fail10("meta_bindings_missing", "required Meta secret bindings are missing");
  const source = await resolveSourceIdentity(slug2, fetchImpl);
  const proof = await appSecretProof(accessToken, appSecret);
  const accountUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/act_${source.accountId}`);
  accountUrl.searchParams.set("fields", "id,currency,timezone_name");
  accountUrl.searchParams.set("appsecret_proof", proof);
  const account = await metaJson(fetchImpl, accountUrl, accessToken);
  const returnedId = normalizedAccountId2(account.body?.id);
  const currency3 = norm2(account.body?.currency).toUpperCase();
  const timezone3 = validTimezone(account.body?.timezone_name);
  if (returnedId !== source.accountId) fail10("meta_account_mismatch", "Meta account metadata did not match the allowlisted source");
  if (!/^[A-Z]{3}$/.test(currency3)) fail10("meta_schema_mismatch", "Meta account currency is invalid");
  if (!timezone3) fail10("meta_schema_mismatch", "Meta account timezone is invalid");
  const localDate = completedLocalDate(now(), timezone3);
  const day = await loadMetaDay(fetchImpl, source, { currency: currency3, timezone: timezone3 }, localDate, accessToken, proof);
  return {
    ok: true,
    projectSlug: slug2,
    readOnly: true,
    writesPerformed: false,
    source: {
      httpStatus: source.sourceHttpStatus,
      rowCount: source.sourceRowCount,
      accountAllowlistResolved: true,
      reportingCurrency: source.reportingCurrency,
      reportingTimezone: source.reportingTimezone
    },
    account: {
      httpStatus: account.status,
      allowlistMatched: true,
      currency: currency3,
      expectedProviderCurrency: source.expectedProviderCurrency,
      currencyMatched: currency3 === source.expectedProviderCurrency,
      timezone: timezone3
    },
    day,
    mapping: mappingSummary(slug2, day)
  };
}
__name(runAdsReadOnlyPreflight, "runAdsReadOnlyPreflight");
var ADS_READONLY_PREFLIGHT_INTERNALS = Object.freeze({
  META_API_VERSION,
  PILOT_SLUGS,
  PROFKIT_DIRECT_PRIORITY,
  completedLocalDate
});

// src/staging-entrypoint.js
var staging_entrypoint_default = index_default;
var AdsReadOnlyPreflight = class extends WorkerEntrypoint {
  static {
    __name(this, "AdsReadOnlyPreflight");
  }
  async checkPilot(projectSlug) {
    return runAdsReadOnlyPreflight({ projectSlug, env: this.env });
  }
};
export {
  AdsReadOnlyPreflight,
  activeProject,
  databaseHealth,
  staging_entrypoint_default as default,
  handleApi,
  internalAuthorized,
  listProjects,
  projectLeadStatuses,
  publicDashboard,
  publicExchangeRate,
  publicLeads,
  publicTab,
  sameOriginWrite,
  scheduledHousevipSync,
  scheduledPilotSyncs,
  scheduledRealCommerceSync,
  validDate3 as validDate
};

// Recovered from deployed 0f6a980d; exports for the unified shell, not HTTP endpoints.
export { authorizeMvp, projectRecord, handleMvpApi };
