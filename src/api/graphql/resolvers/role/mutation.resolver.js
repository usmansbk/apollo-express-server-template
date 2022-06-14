import QueryError from "~utils/errors/QueryError";
import { Fail, Success } from "~helpers/response";
import { ROLE_PERMISSIONS_PREFIX, USER_PREFIX } from "~helpers/constants/auth";

export default {
  Mutation: {
    async createRole(
      _parent,
      { input: { permissionIds, ...values } },
      { dataSources, db, t }
    ) {
      try {
        const role = await db.sequelize.transaction(async (transaction) => {
          const newRole = await dataSources.roles.create(values, {
            transaction,
          });

          if (permissionIds?.length) {
            await newRole.addPermissions(permissionIds, { transaction });
          }
          return newRole;
        });
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }
        throw e;
      }
    },
    async updateRole(
      _parent,
      { input: { id, ...values } },
      { dataSources, t }
    ) {
      try {
        const role = await dataSources.roles.update(id, values);
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }
        throw e;
      }
    },
    async deleteRole(_parent, { id }, { dataSources, t, cache }) {
      try {
        await dataSources.roles.destroy(id);
        await cache.remove(`${ROLE_PERMISSIONS_PREFIX}:${id}`);
        return Success({ id });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }
        throw e;
      }
    },
    async addPermissionsToRole(
      _parent,
      { roleId, permissionIds },
      { dataSources, db, t, cache }
    ) {
      try {
        const role = await db.sequelize.transaction(async (transaction) => {
          const foundRole = await dataSources.roles.findOne({
            where: {
              id: roleId,
            },
            transaction,
          });
          await foundRole.addPermissions(permissionIds, { transaction });
          return foundRole;
        });
        await cache.remove(`${ROLE_PERMISSIONS_PREFIX}:${role.id}`);
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }
        throw e;
      }
    },
    async assignRoleToUsers(
      _parent,
      { roleId, userIds },
      { dataSources, db, t, cache }
    ) {
      try {
        const role = await db.sequelize.transaction(async (transaction) => {
          const foundRole = await dataSources.roles.findOne({
            where: {
              id: roleId,
            },
            transaction,
          });
          await foundRole.addMembers(userIds, { transaction });
          return foundRole;
        });
        await Promise.all(
          userIds.map((id) => cache.remove(`${USER_PREFIX}:${id}`))
        );
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }
        throw e;
      }
    },
    async removePermissionsFromRole(
      _parent,
      { roleId, permissionIds },
      { dataSources, db, t, cache }
    ) {
      try {
        const role = await db.sequelize.transaction(async (transaction) => {
          const foundRole = await dataSources.roles.findOne({
            where: {
              id: roleId,
            },
            transaction,
          });
          await foundRole.removePermissions(permissionIds, { transaction });
          return foundRole;
        });
        await cache.remove(`${ROLE_PERMISSIONS_PREFIX}:${role.id}`);
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }

        throw e;
      }
    },
    async removeUsersFromRole(
      _parent,
      { roleId, userIds },
      { dataSources, db, t, cache }
    ) {
      try {
        const role = await db.sequelize.transaction(async (transaction) => {
          const foundRole = await dataSources.roles.findOne({
            where: {
              id: roleId,
            },
            transaction,
          });
          await foundRole.removeMembers(userIds, { transaction });
          return foundRole;
        });
        await Promise.all(
          userIds.map((id) => cache.remove(`${USER_PREFIX}:${id}`))
        );
        return Success({ role });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
            code: e.code,
          });
        }

        throw e;
      }
    },
  },
};
