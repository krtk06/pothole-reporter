-- Tender withdrawal state. Kept in its own migration because PostgreSQL does
-- not allow a newly added enum value to be used in the same transaction.
ALTER TYPE "TenderStatus" ADD VALUE IF NOT EXISTS 'rejected';
