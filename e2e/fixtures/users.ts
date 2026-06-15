export interface E2EUser {
  email: string;
  password: string;
}

export function createE2EUser(prefix = 'user'): E2EUser {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    email: `e2e_${prefix}_${nonce}@example.com`,
    password: 'Passw0rd!'
  };
}
