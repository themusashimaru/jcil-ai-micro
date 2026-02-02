/**
 * CERTIFICATE-VALIDATOR TOOL
 * X.509 certificate validation, parsing, and chain verification
 * Educational implementation of PKI concepts
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const certificatevalidatorTool: UnifiedTool = {
  name: 'certificate_validator',
  description: 'X.509 certificate validation and chain verification',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['validate', 'verify_chain', 'check_revocation', 'parse', 'create_demo', 'info'],
        description: 'Operation to perform'
      },
      certificate: {
        type: 'string',
        description: 'PEM-encoded certificate or certificate data'
      },
      chain: {
        type: 'array',
        items: { type: 'string' },
        description: 'Certificate chain for verification'
      },
      hostname: {
        type: 'string',
        description: 'Hostname to verify against certificate'
      }
    },
    required: ['operation']
  }
};

// Certificate structure
interface X509Certificate {
  version: number;
  serialNumber: string;
  signatureAlgorithm: string;
  issuer: {
    CN?: string;
    O?: string;
    OU?: string;
    C?: string;
    ST?: string;
    L?: string;
  };
  subject: {
    CN?: string;
    O?: string;
    OU?: string;
    C?: string;
    ST?: string;
    L?: string;
  };
  validity: {
    notBefore: Date;
    notAfter: Date;
  };
  publicKey: {
    algorithm: string;
    keySize: number;
    modulus?: string;
    exponent?: number;
  };
  extensions: {
    basicConstraints?: { ca: boolean; pathLength?: number };
    keyUsage?: string[];
    extKeyUsage?: string[];
    subjectAltName?: string[];
    authorityKeyIdentifier?: string;
    subjectKeyIdentifier?: string;
    crlDistributionPoints?: string[];
    authorityInfoAccess?: { ocsp?: string; caIssuers?: string };
  };
  signature: string;
  fingerprint: {
    sha256: string;
    sha1: string;
  };
}

// Parse a simulated/demo certificate
function parseCertificate(certData: string): X509Certificate {
  // Check for PEM format
  const pemMatch = certData.match(/-----BEGIN CERTIFICATE-----([^-]+)-----END CERTIFICATE-----/s);

  // For demo purposes, create a parsed certificate structure
  // In real implementation, this would use ASN.1 DER parsing

  const now = new Date();
  const yearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Generate deterministic values from input
  const hash = simpleHash(certData);

  return {
    version: 3,
    serialNumber: hash.substring(0, 16).toUpperCase(),
    signatureAlgorithm: 'SHA256withRSA',
    issuer: {
      CN: 'Demo CA',
      O: 'Demo Organization',
      C: 'US'
    },
    subject: {
      CN: extractCN(certData) || 'demo.example.com',
      O: 'Demo Subject Org',
      C: 'US'
    },
    validity: {
      notBefore: now,
      notAfter: yearFromNow
    },
    publicKey: {
      algorithm: 'RSA',
      keySize: 2048,
      modulus: hash.substring(0, 64),
      exponent: 65537
    },
    extensions: {
      basicConstraints: { ca: false },
      keyUsage: ['digitalSignature', 'keyEncipherment'],
      extKeyUsage: ['serverAuth', 'clientAuth'],
      subjectAltName: ['DNS:demo.example.com', 'DNS:www.demo.example.com'],
      subjectKeyIdentifier: hash.substring(0, 40),
      crlDistributionPoints: ['http://crl.demo.example.com/ca.crl'],
      authorityInfoAccess: {
        ocsp: 'http://ocsp.demo.example.com',
        caIssuers: 'http://ca.demo.example.com/ca.crt'
      }
    },
    signature: hash,
    fingerprint: {
      sha256: hash,
      sha1: hash.substring(0, 40)
    }
  };
}

// Simple hash for demo purposes
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const h1 = Math.abs(hash).toString(16).padStart(8, '0');

  hash = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i--) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const h2 = Math.abs(hash).toString(16).padStart(8, '0');

  return (h1 + h2 + h1 + h2 + h1 + h2 + h1 + h2).substring(0, 64);
}

// Extract CN from certificate data
function extractCN(certData: string): string | null {
  const cnMatch = certData.match(/CN=([^,\n]+)/i);
  return cnMatch ? cnMatch[1].trim() : null;
}

// Validate certificate
function validateCertificate(cert: X509Certificate, hostname?: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: Array<{ check: string; passed: boolean; details: string }>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Array<{ check: string; passed: boolean; details: string }> = [];

  // Check 1: Certificate version
  const versionOk = cert.version === 3;
  checks.push({
    check: 'Certificate Version',
    passed: versionOk,
    details: `Version ${cert.version} ${versionOk ? '(X.509 v3)' : '- should be v3'}`
  });
  if (!versionOk) warnings.push('Certificate should be X.509 v3');

  // Check 2: Validity period - not yet valid
  const now = new Date();
  const notYetValid = now < cert.validity.notBefore;
  checks.push({
    check: 'Not Yet Valid',
    passed: !notYetValid,
    details: notYetValid ? `Valid from ${cert.validity.notBefore.toISOString()}` : 'Certificate is active'
  });
  if (notYetValid) errors.push('Certificate not yet valid');

  // Check 3: Validity period - expired
  const expired = now > cert.validity.notAfter;
  checks.push({
    check: 'Expiration',
    passed: !expired,
    details: expired ? `Expired on ${cert.validity.notAfter.toISOString()}` : `Valid until ${cert.validity.notAfter.toISOString()}`
  });
  if (expired) errors.push('Certificate has expired');

  // Check 4: Expiring soon (within 30 days)
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const expiringSoon = !expired && (cert.validity.notAfter.getTime() - now.getTime() < thirtyDays);
  checks.push({
    check: 'Expiration Warning',
    passed: !expiringSoon,
    details: expiringSoon ? 'Certificate expires within 30 days' : 'Not expiring soon'
  });
  if (expiringSoon) warnings.push('Certificate expires within 30 days');

  // Check 5: Key size
  const keySizeOk = cert.publicKey.keySize >= 2048;
  checks.push({
    check: 'Key Size',
    passed: keySizeOk,
    details: `${cert.publicKey.keySize}-bit ${cert.publicKey.algorithm} ${keySizeOk ? '(adequate)' : '(too small)'}`
  });
  if (!keySizeOk) errors.push('Key size too small (minimum 2048 bits for RSA)');

  // Check 6: Signature algorithm
  const weakAlgorithms = ['MD5', 'SHA1'];
  const sigAlgWeak = weakAlgorithms.some(w => cert.signatureAlgorithm.toUpperCase().includes(w));
  checks.push({
    check: 'Signature Algorithm',
    passed: !sigAlgWeak,
    details: `${cert.signatureAlgorithm} ${sigAlgWeak ? '(weak/deprecated)' : '(secure)'}`
  });
  if (sigAlgWeak) warnings.push('Weak signature algorithm');

  // Check 7: Hostname verification
  if (hostname) {
    const hostnames = [
      cert.subject.CN,
      ...(cert.extensions.subjectAltName || [])
        .filter(san => san.startsWith('DNS:'))
        .map(san => san.substring(4))
    ];

    const hostnameMatch = hostnames.some(h => {
      if (!h) return false;
      if (h === hostname) return true;
      // Wildcard matching
      if (h.startsWith('*.')) {
        const wildcard = h.substring(2);
        const parts = hostname.split('.');
        if (parts.length > 1) {
          return parts.slice(1).join('.') === wildcard;
        }
      }
      return false;
    });

    checks.push({
      check: 'Hostname Verification',
      passed: hostnameMatch,
      details: hostnameMatch ? `Hostname '${hostname}' matches` : `Hostname '${hostname}' not in certificate`
    });
    if (!hostnameMatch) errors.push(`Hostname '${hostname}' does not match certificate`);
  }

  // Check 8: Key usage for TLS
  const hasDigitalSig = cert.extensions.keyUsage?.includes('digitalSignature');
  const hasKeyEnc = cert.extensions.keyUsage?.includes('keyEncipherment');
  const keyUsageOk = hasDigitalSig || hasKeyEnc;
  checks.push({
    check: 'Key Usage',
    passed: keyUsageOk,
    details: `Key usage: ${cert.extensions.keyUsage?.join(', ') || 'none specified'}`
  });

  // Check 9: Extended key usage
  const hasServerAuth = cert.extensions.extKeyUsage?.includes('serverAuth');
  checks.push({
    check: 'Extended Key Usage',
    passed: hasServerAuth !== false,
    details: `Extended key usage: ${cert.extensions.extKeyUsage?.join(', ') || 'none specified'}`
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks
  };
}

// Verify certificate chain
function verifyCertificateChain(chain: X509Certificate[]): {
  valid: boolean;
  chainPath: string[];
  errors: string[];
  details: Array<{ level: number; subject: string; issuer: string; status: string }>;
} {
  const errors: string[] = [];
  const chainPath: string[] = [];
  const details: Array<{ level: number; subject: string; issuer: string; status: string }> = [];

  if (chain.length === 0) {
    return { valid: false, chainPath: [], errors: ['Empty certificate chain'], details: [] };
  }

  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i];
    const subject = cert.subject.CN || 'Unknown';
    const issuer = cert.issuer.CN || 'Unknown';
    chainPath.push(subject);

    let status = 'OK';

    // Check if certificate is expired
    const now = new Date();
    if (now > cert.validity.notAfter) {
      status = 'EXPIRED';
      errors.push(`Certificate ${i + 1} (${subject}) is expired`);
    } else if (now < cert.validity.notBefore) {
      status = 'NOT YET VALID';
      errors.push(`Certificate ${i + 1} (${subject}) is not yet valid`);
    }

    // Check chain linkage (issuer of cert[i] should match subject of cert[i+1])
    if (i < chain.length - 1) {
      const nextCert = chain[i + 1];
      if (cert.issuer.CN !== nextCert.subject.CN) {
        errors.push(`Chain broken: ${subject} issuer (${issuer}) doesn't match next cert (${nextCert.subject.CN})`);
        status = 'CHAIN ERROR';
      }
    }

    // Check if last cert is self-signed (root CA)
    if (i === chain.length - 1) {
      if (cert.subject.CN !== cert.issuer.CN) {
        errors.push('Chain does not end with a root CA (self-signed certificate)');
      } else {
        status = 'ROOT CA';
      }
    }

    // Check CA flag for intermediate certificates
    if (i > 0 && i < chain.length - 1) {
      if (!cert.extensions.basicConstraints?.ca) {
        warnings: errors.push(`Intermediate certificate ${subject} is not marked as CA`);
      }
    }

    details.push({ level: i, subject, issuer, status });
  }

  return {
    valid: errors.length === 0,
    chainPath,
    errors,
    details
  };
}

// Create demo certificate chain
function createDemoCertificates(): {
  root: X509Certificate;
  intermediate: X509Certificate;
  endEntity: X509Certificate;
} {
  const now = new Date();
  const tenYears = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  const fiveYears = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
  const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const root: X509Certificate = {
    version: 3,
    serialNumber: '01',
    signatureAlgorithm: 'SHA256withRSA',
    issuer: { CN: 'Demo Root CA', O: 'Demo PKI', C: 'US' },
    subject: { CN: 'Demo Root CA', O: 'Demo PKI', C: 'US' },
    validity: { notBefore: now, notAfter: tenYears },
    publicKey: { algorithm: 'RSA', keySize: 4096 },
    extensions: {
      basicConstraints: { ca: true },
      keyUsage: ['keyCertSign', 'cRLSign'],
      subjectKeyIdentifier: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2'
    },
    signature: 'root-signature-placeholder',
    fingerprint: {
      sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      sha1: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    }
  };

  const intermediate: X509Certificate = {
    version: 3,
    serialNumber: '02',
    signatureAlgorithm: 'SHA256withRSA',
    issuer: { CN: 'Demo Root CA', O: 'Demo PKI', C: 'US' },
    subject: { CN: 'Demo Intermediate CA', O: 'Demo PKI', C: 'US' },
    validity: { notBefore: now, notAfter: fiveYears },
    publicKey: { algorithm: 'RSA', keySize: 2048 },
    extensions: {
      basicConstraints: { ca: true, pathLength: 0 },
      keyUsage: ['keyCertSign', 'cRLSign'],
      authorityKeyIdentifier: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2',
      subjectKeyIdentifier: 'B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3'
    },
    signature: 'intermediate-signature-placeholder',
    fingerprint: {
      sha256: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
      sha1: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'
    }
  };

  const endEntity: X509Certificate = {
    version: 3,
    serialNumber: '03',
    signatureAlgorithm: 'SHA256withRSA',
    issuer: { CN: 'Demo Intermediate CA', O: 'Demo PKI', C: 'US' },
    subject: { CN: 'www.example.com', O: 'Example Corp', C: 'US' },
    validity: { notBefore: now, notAfter: oneYear },
    publicKey: { algorithm: 'RSA', keySize: 2048 },
    extensions: {
      basicConstraints: { ca: false },
      keyUsage: ['digitalSignature', 'keyEncipherment'],
      extKeyUsage: ['serverAuth', 'clientAuth'],
      subjectAltName: ['DNS:www.example.com', 'DNS:example.com', 'DNS:*.example.com'],
      authorityKeyIdentifier: 'B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3',
      subjectKeyIdentifier: 'C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
      crlDistributionPoints: ['http://crl.demo.example.com/intermediate.crl'],
      authorityInfoAccess: {
        ocsp: 'http://ocsp.demo.example.com',
        caIssuers: 'http://ca.demo.example.com/intermediate.crt'
      }
    },
    signature: 'end-entity-signature-placeholder',
    fingerprint: {
      sha256: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      sha1: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    }
  };

  return { root, intermediate, endEntity };
}

// Format certificate for display
function formatCertificate(cert: X509Certificate): string {
  const lines: string[] = [];

  lines.push('Certificate:');
  lines.push(`    Version: ${cert.version} (0x${(cert.version - 1).toString(16)})`);
  lines.push(`    Serial Number: ${cert.serialNumber}`);
  lines.push(`    Signature Algorithm: ${cert.signatureAlgorithm}`);
  lines.push('    Issuer:');
  for (const [key, value] of Object.entries(cert.issuer)) {
    if (value) lines.push(`        ${key}=${value}`);
  }
  lines.push('    Validity:');
  lines.push(`        Not Before: ${cert.validity.notBefore.toISOString()}`);
  lines.push(`        Not After : ${cert.validity.notAfter.toISOString()}`);
  lines.push('    Subject:');
  for (const [key, value] of Object.entries(cert.subject)) {
    if (value) lines.push(`        ${key}=${value}`);
  }
  lines.push('    Subject Public Key Info:');
  lines.push(`        Algorithm: ${cert.publicKey.algorithm}`);
  lines.push(`        Key Size: ${cert.publicKey.keySize} bits`);
  if (cert.publicKey.exponent) {
    lines.push(`        Exponent: ${cert.publicKey.exponent} (0x${cert.publicKey.exponent.toString(16)})`);
  }
  lines.push('    X509v3 Extensions:');
  if (cert.extensions.basicConstraints) {
    lines.push(`        Basic Constraints: CA:${cert.extensions.basicConstraints.ca.toString().toUpperCase()}`);
  }
  if (cert.extensions.keyUsage) {
    lines.push(`        Key Usage: ${cert.extensions.keyUsage.join(', ')}`);
  }
  if (cert.extensions.extKeyUsage) {
    lines.push(`        Extended Key Usage: ${cert.extensions.extKeyUsage.join(', ')}`);
  }
  if (cert.extensions.subjectAltName) {
    lines.push(`        Subject Alt Name: ${cert.extensions.subjectAltName.join(', ')}`);
  }
  lines.push('    Fingerprints:');
  lines.push(`        SHA-256: ${cert.fingerprint.sha256}`);
  lines.push(`        SHA-1: ${cert.fingerprint.sha1}`);

  return lines.join('\n');
}

export async function executecertificatevalidator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, certificate, chain, hostname } = args;

    if (operation === 'info') {
      const info = {
        tool: 'certificate_validator',
        description: 'X.509 certificate validation and PKI operations',
        concepts: {
          x509: 'Standard format for public key certificates',
          pki: 'Public Key Infrastructure - system for managing certificates',
          ca: 'Certificate Authority - trusted entity that issues certificates',
          chain_of_trust: 'Hierarchy from root CA → intermediate CA → end entity'
        },
        certificate_fields: {
          version: 'X.509 version (usually v3)',
          serial_number: 'Unique identifier from CA',
          signature_algorithm: 'Algorithm used to sign certificate',
          issuer: 'Entity that issued/signed the certificate',
          subject: 'Entity the certificate identifies',
          validity: 'Not Before and Not After dates',
          public_key: 'Subject\'s public key and algorithm',
          extensions: 'Additional attributes (v3 only)'
        },
        important_extensions: {
          basic_constraints: 'Whether cert can sign other certs (CA flag)',
          key_usage: 'Allowed uses (signing, encryption, etc.)',
          extended_key_usage: 'Specific purposes (serverAuth, clientAuth, etc.)',
          subject_alt_name: 'Additional identities (DNS names, IPs, emails)',
          authority_key_identifier: 'Identifies issuer\'s key',
          crl_distribution_points: 'Where to check for revocation',
          authority_info_access: 'OCSP and CA issuer locations'
        },
        validation_checks: [
          'Signature verification',
          'Validity period (not expired, not yet valid)',
          'Chain of trust (path to trusted root)',
          'Revocation status (CRL/OCSP)',
          'Hostname matching (for TLS)',
          'Key usage constraints',
          'Basic constraints (CA flag)',
          'Name constraints'
        ],
        operations: ['validate', 'verify_chain', 'check_revocation', 'parse', 'create_demo']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'create_demo') {
      const demoCerts = createDemoCertificates();

      const result = {
        operation: 'create_demo',
        description: 'Demo PKI hierarchy with root, intermediate, and end-entity certificates',
        certificates: {
          root: {
            subject: demoCerts.root.subject,
            issuer: demoCerts.root.issuer,
            validity: demoCerts.root.validity,
            is_ca: demoCerts.root.extensions.basicConstraints?.ca,
            self_signed: demoCerts.root.subject.CN === demoCerts.root.issuer.CN
          },
          intermediate: {
            subject: demoCerts.intermediate.subject,
            issuer: demoCerts.intermediate.issuer,
            validity: demoCerts.intermediate.validity,
            is_ca: demoCerts.intermediate.extensions.basicConstraints?.ca,
            path_length: demoCerts.intermediate.extensions.basicConstraints?.pathLength
          },
          end_entity: {
            subject: demoCerts.endEntity.subject,
            issuer: demoCerts.endEntity.issuer,
            validity: demoCerts.endEntity.validity,
            is_ca: demoCerts.endEntity.extensions.basicConstraints?.ca,
            san: demoCerts.endEntity.extensions.subjectAltName
          }
        },
        chain_visualization: [
          '┌─────────────────────────────────────┐',
          '│           Demo Root CA              │  ← Trust Anchor (self-signed)',
          '│    Subject = Issuer = "Demo Root"   │',
          '│    CA: TRUE, Key: 4096-bit RSA      │',
          '└──────────────────┬──────────────────┘',
          '                   │ signs',
          '                   ▼',
          '┌─────────────────────────────────────┐',
          '│       Demo Intermediate CA          │  ← Intermediate CA',
          '│    Issuer = "Demo Root"             │',
          '│    CA: TRUE, pathLen: 0             │',
          '└──────────────────┬──────────────────┘',
          '                   │ signs',
          '                   ▼',
          '┌─────────────────────────────────────┐',
          '│        www.example.com              │  ← End Entity (leaf)',
          '│    Issuer = "Demo Intermediate"     │',
          '│    CA: FALSE, serverAuth            │',
          '│    SAN: example.com, *.example.com  │',
          '└─────────────────────────────────────┘'
        ].join('\n'),
        full_certificates: {
          root: formatCertificate(demoCerts.root),
          intermediate: formatCertificate(demoCerts.intermediate),
          end_entity: formatCertificate(demoCerts.endEntity)
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'parse') {
      if (!certificate) {
        return {
          toolCallId: id,
          content: 'Error: certificate required for parsing',
          isError: true
        };
      }

      const cert = parseCertificate(certificate);

      const result = {
        operation: 'parse',
        parsed: {
          version: cert.version,
          serial_number: cert.serialNumber,
          signature_algorithm: cert.signatureAlgorithm,
          issuer: cert.issuer,
          subject: cert.subject,
          validity: {
            not_before: cert.validity.notBefore.toISOString(),
            not_after: cert.validity.notAfter.toISOString(),
            days_remaining: Math.floor((cert.validity.notAfter.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          },
          public_key: cert.publicKey,
          extensions: cert.extensions,
          fingerprints: cert.fingerprint
        },
        formatted: formatCertificate(cert)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'validate') {
      const cert = certificate ? parseCertificate(certificate) : createDemoCertificates().endEntity;
      const validation = validateCertificate(cert, hostname);

      const result = {
        operation: 'validate',
        certificate: {
          subject: cert.subject.CN,
          issuer: cert.issuer.CN,
          validity: {
            not_before: cert.validity.notBefore.toISOString(),
            not_after: cert.validity.notAfter.toISOString()
          }
        },
        hostname_checked: hostname || null,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        },
        checks: validation.checks,
        summary: validation.valid
          ? '✓ Certificate is valid'
          : `✗ Certificate is invalid: ${validation.errors.join('; ')}`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'verify_chain') {
      const demoCerts = createDemoCertificates();
      const certChain = [demoCerts.endEntity, demoCerts.intermediate, demoCerts.root];

      const chainResult = verifyCertificateChain(certChain);

      const result = {
        operation: 'verify_chain',
        chain_length: certChain.length,
        chain_path: chainResult.chainPath,
        verification: {
          valid: chainResult.valid,
          errors: chainResult.errors
        },
        details: chainResult.details,
        visualization: [
          'Certificate Chain Verification:',
          '================================',
          ...chainResult.details.map((d, i) => {
            const indent = '  '.repeat(i);
            const status = d.status === 'OK' || d.status === 'ROOT CA' ? '✓' : '✗';
            return `${indent}${status} [${d.level}] ${d.subject}`;
          }),
          '',
          `Result: ${chainResult.valid ? 'Chain is valid ✓' : 'Chain verification failed ✗'}`
        ].join('\n')
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'check_revocation') {
      const cert = certificate ? parseCertificate(certificate) : createDemoCertificates().endEntity;

      const result = {
        operation: 'check_revocation',
        certificate: {
          subject: cert.subject.CN,
          serial: cert.serialNumber
        },
        revocation_info: {
          crl_distribution_points: cert.extensions.crlDistributionPoints || [],
          ocsp_responder: cert.extensions.authorityInfoAccess?.ocsp || null
        },
        methods: {
          crl: {
            name: 'Certificate Revocation List',
            description: 'Periodically downloaded list of revoked certificates',
            pros: ['Simple', 'Can be cached'],
            cons: ['Large downloads', 'May be stale']
          },
          ocsp: {
            name: 'Online Certificate Status Protocol',
            description: 'Real-time query to CA about certificate status',
            pros: ['Real-time', 'Small responses'],
            cons: ['Requires network', 'Privacy concerns']
          },
          ocsp_stapling: {
            name: 'OCSP Stapling',
            description: 'Server provides cached OCSP response',
            pros: ['Fast', 'Privacy preserving'],
            cons: ['Requires server support']
          }
        },
        simulated_result: {
          status: 'GOOD',
          revoked: false,
          revocation_reason: null,
          this_update: new Date().toISOString(),
          next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          note: 'This is a simulated response for educational purposes'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscertificatevalidatorAvailable(): boolean { return true; }
