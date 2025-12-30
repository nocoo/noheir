-- ============================================================================
-- Import Financial Products from CSV Data
-- One-time import of existing financial products
-- ============================================================================

-- Note: Replace b5a58998-bee3-43fd-9fe1-ab5ed97a8076 with your actual user UUID from auth.users
-- You can get this by running: SELECT id, email FROM auth.users;

INSERT INTO financial_products (
  user_id,
  name,
  code,
  channel,
  category,
  currency,
  lock_period_days,
  annual_return_rate,
  created_at
) VALUES
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '金盈年年养老年金', NULL, '光大永明', '养老年金', 'CNY', 10800, 5.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '个人养老金账户', NULL, '招商银行', '养老年金', 'CNY', 10800, 3.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '平安盈尊3.0', NULL, '平安银行', '储蓄保险', 'CNY', 1825, 2.5, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '中银国有企业债A', '001235', '招商银行', '混债基金', 'CNY', 180, 7.6, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '景顺长城稳健增益债券A', '016869', '支付宝', '混债基金', 'CNY', 180, 8.43, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '银河领先债券A', '519669', '平安银行', '混债基金', 'CNY', 180, 6.92, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '华泰保兴尊合债券C', '005160', '平安银行', '混债基金', 'CNY', 30, 7.21, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '易方达(香港)美元货币市场基金', 'HK0000365384', '招银香港', '货币基金', 'USD', 0, 4.5, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '享定存三年期', NULL, '招商银行', '定期存款', 'CNY', 1080, 1.8, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '江虹萱: 稳健理财', NULL, '平安银行', '理财产品', 'CNY', 0, 2.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '平安理财-安稳启航增强稳盈三个月定开13号A', 'QZWG03M13A', '平安银行', '理财产品', 'CNY', 91, 2.4, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '交银理财-稳享智选日开16号', '5811225257', '平安银行', '理财产品', 'CNY', 91, 2.4, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '光大理财-创利360天持有期D', 'Z7001424000614', '微众银行', '理财产品', 'CNY', 360, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '华夏港股通央企红利ETF联接A', '021142', '支付宝', '股票基金', 'CNY', 7, 27.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '华夏沪深300指数增强A', '001015', '支付宝', '指数基金', 'CNY', 0, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '博时黄金ETF联接C', '002611', '支付宝', '指数基金', 'CNY', 0, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '华夏黄金ETF联接A', '008701', '平安银行', '指数基金', 'CNY', 30, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '华泰柏瑞沪深300ETF联接A', '460300', '平安银行', '指数基金', 'CNY', 180, 2.5, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '上银慧元利90天持有期债券A', '021282', '支付宝', '债券基金', 'CNY', 90, 4.54, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '兴业稳瑞90天持有期债券A', '020727', '支付宝', '债券基金', 'CNY', 90, 3.72, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '灵活宝', NULL, '平安银行', '现金+', 'CNY', 0, 1.5, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '活期+ PLUS (5万)', NULL, '微众银行', '现金+', 'CNY', 7, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '活期+ PLUS (1万)', NULL, '微众银行', '现金+', 'CNY', 7, 4.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '茂源量化多策略18号', 'T1E297', '平安银行', '私募基金', 'CNY', 365, NULL, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '周周安', NULL, '平安银行', '理财产品', 'CNY', 7, 2.0, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '结构性存款', NULL, '平安银行', '理财产品', 'CNY', 25, 1.5, NOW()),
('b5a58998-bee3-43fd-9fe1-ab5ed97a8076', '余额宝', NULL, '支付宝', '现金+', 'CNY', 0, 1.5, NOW());
