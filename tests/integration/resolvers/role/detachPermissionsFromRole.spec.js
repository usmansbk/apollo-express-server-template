import { gql } from "apollo-server-express";
import createApolloTestServer from "tests/mocks/apolloServer";
import FactoryBot from "tests/factories";
import cache from "~utils/cache";
import { PERMISSIONS_KEY_PREFIX } from "~constants/auth";

const query = gql`
  mutation DetachPermissionsFromRole($roleId: ID!, $permissionIds: [ID!]!) {
    detachPermissionsFromRole(roleId: $roleId, permissionIds: $permissionIds) {
      code
      message
      role {
        permissions {
          id
        }
      }
    }
  }
`;

describe("Mutation.detachPermissionsFromRole", () => {
  let server;
  beforeAll(() => {
    server = createApolloTestServer();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    await FactoryBot.truncate();
  });

  describe("admin", () => {
    let admin;
    beforeEach(async () => {
      admin = await FactoryBot.create("user", {
        include: {
          roles: {
            name: "admin",
          },
        },
      });
    });

    test("should detach permission from role", async () => {
      const permission = await FactoryBot.create("permission");
      const role = await FactoryBot.create("role");
      await role.addPermission(permission);

      const res = await server.executeOperation(
        {
          query,
          variables: {
            roleId: role.id,
            permissionIds: [permission.id],
          },
        },
        { currentUser: admin }
      );

      expect(res.data.detachPermissionsFromRole.role.permissions).toHaveLength(
        0
      );
    });

    test("should invalidate members cached permissions", async () => {
      const permission = await FactoryBot.create("permission");
      const other = await FactoryBot.create("user");
      const role = await FactoryBot.create("role", {
        name: "staff",
      });
      await role.addMember(other);

      const key = `${PERMISSIONS_KEY_PREFIX}:${other.id}`;
      await cache.set({
        key,
        value: "mockPermissions",
        expiresIn: 10000,
      });

      await server.executeOperation(
        {
          query,
          variables: {
            roleId: other.id,
            permissionIds: [permission.id],
          },
        },
        { currentUser: admin }
      );

      const cachedPermissions = await cache.get(key);

      expect(cachedPermissions).toBe(null);
    });
  });
});
