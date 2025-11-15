use std::fmt;

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::Result;
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct EncryptedBlob {
    pub version: u32,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub fn seal(master_password: &str, plaintext: &[u8]) -> Result<EncryptedBlob> {
    let salt = generate_salt();
    let key = derive_key(master_password, &salt)?;
    let nonce = generate_nonce();

    let cipher = Aes256Gcm::new_from_slice(&key)?;
    let ciphertext = cipher.encrypt(Nonce::from_slice(&nonce), plaintext)?;

    Ok(EncryptedBlob {
        version: 1,
        salt: B64.encode(&salt),
        nonce: B64.encode(&nonce),
        ciphertext: B64.encode(ciphertext),
    })
}

pub fn open(master_password: &str, blob: &EncryptedBlob) -> Result<Vec<u8>> {
    let salt = B64.decode(&blob.salt)?;
    let nonce = B64.decode(&blob.nonce)?;
    let ciphertext = B64.decode(&blob.ciphertext)?;

    let key = derive_key(master_password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)?;

    let plaintext = cipher.decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())?;
    Ok(plaintext)
}

fn derive_key(master_password: &str, salt: &[u8]) -> Result<[u8; 32]> {
    let argon2 = Argon2::default();
    let salt_string = SaltString::b64_encode(salt).map_err(|err| anyhow::anyhow!("{err}"))?;
    let mut key = [0u8; 32];
    argon2.hash_password_into(master_password.as_bytes(), salt_string.as_salt(), &mut key)?;
    Ok(key)
}

fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

fn generate_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);
    nonce
}
