-- CREATEDB is local-development-only and lets Prisma create disposable shadow databases.
-- Production migration identities must use narrower permissions.
CREATE ROLE agentfactory_identity LOGIN CREATEDB PASSWORD 'identity_dev_only';
CREATE ROLE agentfactory_entitlement LOGIN CREATEDB PASSWORD 'entitlement_dev_only';
CREATE ROLE agentfactory_project LOGIN CREATEDB PASSWORD 'project_dev_only';

CREATE DATABASE agentfactory_identity OWNER agentfactory_identity;
CREATE DATABASE agentfactory_entitlement OWNER agentfactory_entitlement;
CREATE DATABASE agentfactory_project OWNER agentfactory_project;
