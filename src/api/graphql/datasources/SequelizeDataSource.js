/* eslint-disable class-methods-use-this */
import {
  EmptyResultError,
  Op,
  UniqueConstraintError,
  ValidationError,
} from "sequelize";
import { DataSource } from "apollo-datasource";
import DataLoader from "dataloader";
import formatErrors from "~utils/formatErrors";
import FieldErrors from "~utils/errors/FieldErrors";
import QueryError from "~utils/errors/QueryError";
import {
  ensureDeterministicOrder,
  createCursor,
  parseCursor,
  reverseOrder,
  getPaginationQuery,
  normalizeOrder,
} from "~utils/paginate";
import { FIELD_ERRORS, ITEM_NOT_FOUND } from "~constants/i18n";

/**
 * The SequelizeDataSource abstract class helps you query data from an SQL database. Your server
 * defines a separate subclass of SequelizeDataSource for each Model it communicates with.
 * It is configured with a Dataloader to prevent the N+1 problem (loading the same object multiple times during a single request).
 *
 * The onCreate, onUpdate, and onDestroy hooks can be overwritten in the child classes.
 *
 * Subclasses with catch exceptions they can handle and rethrow unknown errors
 */
export default class SequelizeDataSource extends DataSource {
  constructor(model) {
    super();
    this.model = model;
    this.loader = new DataLoader(async (ids) => {
      const result = await this.model.findAll({
        where: {
          id: ids,
        },
      });

      const map = {};
      result.forEach((elem) => {
        map[elem.id] = elem;
      });

      return ids.map((id) => map[id]);
    });
  }

  initialize({ context } = {}) {
    this.context = context;
  }

  onCreate({ newItem }) {
    this.prime(newItem);
  }

  onUpdate({ newItem }) {
    this.prime(newItem);
  }

  onDestroy() {}

  onError(e) {
    if (e instanceof ValidationError || e instanceof UniqueConstraintError) {
      throw new FieldErrors(
        FIELD_ERRORS,
        formatErrors(e.errors, this.context.t),
        e
      );
    } else if (e instanceof EmptyResultError) {
      throw new QueryError(ITEM_NOT_FOUND, e);
    } else {
      throw e;
    }
  }

  async prime(item) {
    this.loader.prime(item.id, item);
  }

  primeMany(items) {
    items.forEach((item) => this.prime(item));
  }

  findByPk(id) {
    if (!id) {
      return null;
    }

    return this.loader.load(id);
  }

  findManyByPk(ids = []) {
    return this.loader.loadMany(ids);
  }

  async findOne(query) {
    const item = await this.model.findOne(query);
    if (item) {
      this.prime(item);
    }

    return item;
  }

  async findAll(query) {
    const items = await this.model.findAll(query);
    this.primeMany(items);

    return items;
  }

  async findAndCountAll(query) {
    const { count, rows } = await this.model.findAndCountAll(query);
    this.primeMany(rows);

    return { count, rows };
  }

  async findOrCreate(queryOptions) {
    try {
      const [newItem, created] = await this.model.findOrCreate(queryOptions);

      if (created) {
        this.onCreate({ newItem });
      } else {
        this.prime(newItem);
      }

      return [newItem, created];
    } catch (e) {
      return this.onError(e);
    }
  }

  async create(fields) {
    try {
      const newItem = await this.model.create(fields);
      this.onCreate({ newItem });

      return newItem;
    } catch (e) {
      return this.onError(e);
    }
  }

  async update(id, fields) {
    try {
      const item = await this.findByPk(id);

      if (!item) {
        throw EmptyResultError();
      }

      const oldImage = item.toJSON();

      const newItem = await item.update(fields);

      this.onUpdate({ newItem, oldImage });

      return newItem;
    } catch (e) {
      return this.onError(e);
    }
  }

  /**
   * Delete is idemponent and shouldn't throw an error if item does not exist
   */
  async destroy(id) {
    const item = await this.findByPk(id);
    if (item) {
      const oldImage = item.toJSON();
      await item.destroy();
      this.onDestroy({ oldImage });
    }
  }

  async paginate({ page, filter, ...queryArgs }) {
    const { limit, order: orderArg, after, before } = page || {};

    let order = normalizeOrder(ensureDeterministicOrder(orderArg || []));

    order = before ? reverseOrder(order) : order;

    let cursor = null;

    if (after) {
      cursor = parseCursor(after);
    } else if (before) {
      cursor = parseCursor(before);
    }

    const paginationQuery = cursor && getPaginationQuery(order, cursor);

    const where = paginationQuery
      ? { [Op.and]: [paginationQuery, filter] }
      : filter;

    const [{ rows, count }, totalCount] = await Promise.all([
      this.findAndCountAll({
        limit: limit + 1,
        order,
        where,
        ...queryArgs,
      }),
      this.model.count({ where: filter, ...queryArgs }),
    ]);

    if (before) {
      rows.reverse();
    }

    const end = rows[limit - 1];
    const endCursor = end && createCursor(order, end);

    const start = rows[0];
    const startCursor = start && createCursor(order, start);

    return {
      items: rows.slice(0, limit),
      totalCount,
      pageInfo: {
        endCursor,
        startCursor,
        hasNextPage: count > limit,
      },
    };
  }
}
