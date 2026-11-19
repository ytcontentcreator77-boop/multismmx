-- Persist a native-denomination wallet balance for each customer's selected currency.
-- USD micro-units remain the immutable accounting/ledger source for audit-safe historical records.
ALTER TABLE users ADD COLUMN wallet_balance_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN wallet_currency_code TEXT NOT NULL DEFAULT 'USD';

UPDATE users
SET wallet_currency_code = COALESCE(currency_code, 'USD'),
    wallet_balance_minor = CAST(ROUND(
      (balance / 1000000.0) * COALESCE((SELECT per_usd FROM currencies WHERE code=users.currency_code), 1)
      * CASE COALESCE((SELECT decimals FROM currencies WHERE code=users.currency_code), 2)
          WHEN 0 THEN 1 WHEN 1 THEN 10 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10000 END
    ) AS INTEGER);

CREATE TRIGGER users_wallet_balance_sync AFTER UPDATE OF balance ON users
WHEN NEW.balance IS NOT OLD.balance
BEGIN
  UPDATE users SET wallet_balance_minor = CAST(ROUND(
    (NEW.balance / 1000000.0) * COALESCE((SELECT per_usd FROM currencies WHERE code=NEW.currency_code), 1)
    * CASE COALESCE((SELECT decimals FROM currencies WHERE code=NEW.currency_code), 2)
        WHEN 0 THEN 1 WHEN 1 THEN 10 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10000 END
  ) AS INTEGER), wallet_currency_code=NEW.currency_code WHERE id=NEW.id;
END;

CREATE TRIGGER users_wallet_currency_sync AFTER UPDATE OF currency_code ON users
WHEN NEW.currency_code IS NOT OLD.currency_code
BEGIN
  UPDATE users SET wallet_balance_minor = CAST(ROUND(
    (NEW.balance / 1000000.0) * COALESCE((SELECT per_usd FROM currencies WHERE code=NEW.currency_code), 1)
    * CASE COALESCE((SELECT decimals FROM currencies WHERE code=NEW.currency_code), 2)
        WHEN 0 THEN 1 WHEN 1 THEN 10 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10000 END
  ) AS INTEGER), wallet_currency_code=NEW.currency_code WHERE id=NEW.id;
END;

CREATE TRIGGER currencies_wallet_rate_sync AFTER UPDATE OF per_usd, decimals ON currencies
WHEN NEW.per_usd IS NOT OLD.per_usd OR NEW.decimals IS NOT OLD.decimals
BEGIN
  UPDATE users SET wallet_balance_minor = CAST(ROUND(
    (balance / 1000000.0) * NEW.per_usd
    * CASE NEW.decimals WHEN 0 THEN 1 WHEN 1 THEN 10 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10000 END
  ) AS INTEGER)
  WHERE currency_code=NEW.code;
END;

CREATE TRIGGER users_wallet_insert_sync AFTER INSERT ON users
BEGIN
  UPDATE users SET wallet_balance_minor = CAST(ROUND(
    (NEW.balance / 1000000.0) * COALESCE((SELECT per_usd FROM currencies WHERE code=NEW.currency_code), 1)
    * CASE COALESCE((SELECT decimals FROM currencies WHERE code=NEW.currency_code), 2)
        WHEN 0 THEN 1 WHEN 1 THEN 10 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10000 END
  ) AS INTEGER), wallet_currency_code=NEW.currency_code WHERE id=NEW.id;
END;
