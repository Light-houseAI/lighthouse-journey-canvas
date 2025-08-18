/**
 * Organizations API Routes
 * RESTful endpoints for organization and membership management
 */

import { Router } from 'express';
import type { AwilixContainer } from 'awilix';
import { OrganizationController } from '../controllers/organization.controller';

export function createOrganizationRoutes(container: AwilixContainer): Router {
  const router = Router();
  
  // Resolve controller from container for each request
  const getController = () => container.resolve<OrganizationController>('organizationController');

  // Organization CRUD
  router.post('/organizations', (req, res) => getController().createOrganization(req, res));
  router.get('/organizations', (req, res) => getController().listOrganizations(req, res));
  router.get('/organizations/search', (req, res) => getController().searchOrganizations(req, res));
  router.get('/organizations/mine', (req, res) => getController().getUserOrganizations(req, res));
  router.get('/organizations/:orgId', (req, res) => getController().getOrganization(req, res));
  router.put('/organizations/:orgId', (req, res) => getController().updateOrganization(req, res));
  router.delete('/organizations/:orgId', (req, res) => getController().deleteOrganization(req, res));

  // Organization membership
  router.get('/organizations/:orgId/members', (req, res) => getController().getMembers(req, res));
  router.post('/organizations/:orgId/members', (req, res) => getController().addMember(req, res));
  router.put('/organizations/:orgId/members/:userId', (req, res) => getController().updateMemberRole(req, res));
  router.delete('/organizations/:orgId/members/:userId', (req, res) => getController().removeMember(req, res));

  // Self-service membership
  router.post('/organizations/:orgId/join', (req, res) => getController().joinOrganization(req, res));
  router.post('/organizations/:orgId/leave', (req, res) => getController().leaveOrganization(req, res));

  return router;
}