import QueryError from "~utils/errors/QueryError";
import { Fail, Success } from "~helpers/response";
import { PERMISSION_NOT_FOUND } from "~helpers/constants/responseCodes";

export default {
  Query: {
    permissions(_parent, { page, filter }, { dataSources }, info) {
      return dataSources.permissions.paginate({
        page,
        filter,
        info,
      });
    },
    async getPermissionById(_parent, { id }, { dataSources, t }, info) {
      try {
        const permission = await dataSources.permissions.findOne({
          where: { id },
          info,
          path: "permission",
        });

        if (!permission) {
          throw new QueryError(PERMISSION_NOT_FOUND);
        }

        return Success({ permission });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            code: e.code,
          });
        }
        throw e;
      }
    },
  },
};
