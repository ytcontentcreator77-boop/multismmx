-- Customer currency preferences and configurable currency presentation.
ALTER TABLE users ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE currencies ADD COLUMN decimals INTEGER NOT NULL DEFAULT 2;
ALTER TABLE currencies ADD COLUMN symbol_visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE currencies ADD COLUMN markup_pct REAL NOT NULL DEFAULT 0;
ALTER TABLE currencies ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
UPDATE currencies SET is_default = CASE WHEN code='USD' THEN 1 ELSE 0 END;
UPDATE currencies SET decimals = CASE WHEN code IN ('JPY','KRW','VND','CLP','XOF','XAF','UGX','RWF','PYG') THEN 0 WHEN code IN ('BHD','KWD','OMR','JOD','TND') THEN 3 ELSE 2 END;
INSERT OR IGNORE INTO currencies (code,name,symbol,per_usd,enabled,decimals,symbol_visible,markup_pct,is_default) VALUES
('CHF','Swiss Franc','CHF',0.89,1,2,1,0,0),('CNY','Chinese Yuan','¥',7.2,1,2,1,0,0),('HKD','Hong Kong Dollar','HK$',7.8,1,2,1,0,0),('SGD','Singapore Dollar','S$',1.35,1,2,1,0,0),('NZD','New Zealand Dollar','NZ$',1.65,1,2,1,0,0),('ZAR','South African Rand','R',18.5,1,2,1,0,0),('KES','Kenyan Shilling','KSh',129,1,2,1,0,0),('GHS','Ghanaian Cedi','GH₵',15,1,2,1,0,0),('TZS','Tanzanian Shilling','TSh',2500,1,2,1,0,0),('UGX','Ugandan Shilling','USh',3800,1,0,1,0,0),('ETB','Ethiopian Birr','Br',56,1,2,1,0,0),('MAD','Moroccan Dirham','د.م.',10,1,2,1,0,0),('DZD','Algerian Dinar','دج',134,1,2,1,0,0),('TND','Tunisian Dinar','د.ت',3.1,1,3,1,0,0),('ILS','Israeli New Shekel','₪',3.7,1,2,1,0,0),('QAR','Qatari Riyal','ر.ق',3.64,1,2,1,0,0),('KWD','Kuwaiti Dinar','د.ك',0.307,1,3,1,0,0),('BHD','Bahraini Dinar','.د.ب',0.376,1,3,1,0,0),('OMR','Omani Rial','ر.ع.',0.385,1,3,1,0,0),('JOD','Jordanian Dinar','د.ا',0.709,1,3,1,0,0),('CLP','Chilean Peso','$',930,1,0,1,0,0),('COP','Colombian Peso','$',4100,1,2,1,0,0),('ARS','Argentine Peso','$',1000,1,2,1,0,0),('MXN','Mexican Peso','$',17,1,2,1,0,0),('PEN','Peruvian Sol','S/',3.75,1,2,1,0,0),('UYU','Uruguayan Peso','$U',39,1,2,1,0,0),('PLN','Polish Zloty','zł',4,1,2,1,0,0),('CZK','Czech Koruna','Kč',23,1,2,1,0,0),('HUF','Hungarian Forint','Ft',360,1,2,1,0,0),('SEK','Swedish Krona','kr',10.5,1,2,1,0,0),('NOK','Norwegian Krone','kr',10.7,1,2,1,0,0),('DKK','Danish Krone','kr',6.9,1,2,1,0,0),('RON','Romanian Leu','lei',4.6,1,2,1,0,0),('UAH','Ukrainian Hryvnia','₴',41,1,2,1,0,0),('XOF','West African CFA Franc','CFA',605,1,0,1,0,0),('XAF','Central African CFA Franc','FCFA',605,1,0,1,0,0),('RWF','Rwandan Franc','RF',1300,1,0,1,0,0),('PYG','Paraguayan Guarani','₲',7300,1,0,1,0,0);
CREATE TRIGGER users_default_currency AFTER INSERT ON users
BEGIN
  UPDATE users SET currency_code = COALESCE((SELECT code FROM currencies WHERE is_default=1 LIMIT 1),'USD') WHERE id=NEW.id;
END;
