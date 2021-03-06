import express from 'express';
import {
  DiskFileBackend,
  S3FileBackend,
  MemoryFileBackend,
} from './oldFileStoreBackend.js';

const DEFAULT_PREFIX = 'file';

/* ROADMAP
- Add security
*/

const errorGuard = (func) => async (req, res, next) => {
  try {
    return await func(req, res, next);
  } catch (error) {
    //console.log(error);
    next(error);
  }
};

const getPathFromReqWithoutSiteId = (req) => {
  const {
    params: { namespace },
  } = req;

  return namespace;
};

/**
 *
 * @param {object} options
 */
export const fileStorage = (type = 'memory', config = {}) => {
  const app = express.Router();

  const { url = '', prefix = DEFAULT_PREFIX } = config;

  let backend = null;

  const backendConfig = { pathFromReq: getPathFromReqWithoutSiteId, ...config };

  if (type === 'memory') {
    backend = MemoryFileBackend(backendConfig);
  }
  if (type === 'disk') {
    backend = DiskFileBackend(backendConfig);
  }
  if (type === 's3') {
    backend = S3FileBackend(backendConfig);
  }

  // Store a file
  app.post(
    `/${prefix}/:namespace/`,
    backend.uploadManager,
    errorGuard(async (req, res) => {
      const { params: { namespace } = {} } = req;

      await backend.store(namespace, req.file);

      res.send(`${url}/${prefix}/${namespace}/${req.file.filename}`);
    })
  );

  // List stored file under namespace
  app.get(
    `/${prefix}/:namespace/`,
    errorGuard(async (req, res) => {
      const {
        params: { namespace },
      } = req;

      const result = await backend.list(namespace);

      res.json(
        result.map((filename) => `${url}/${prefix}/${namespace}/${filename}`)
      );
    })
  );

  // Get one file
  app.get(
    `/${prefix}/:namespace/:filename`,
    errorGuard(async (req, res, next) => {
      const {
        params: { filename, namespace },
      } = req;

      if (!(await backend.exists(namespace, filename))) {
        res.status(404).send('Not found');
        return;
      }

      const {
        stream,
        redirectTo,
        mimetype,
        length,
        lastModifield,
        eTag,
        statusCode = 200,
      } = await backend.get(namespace, filename, req.headers);

      // Here the backend respond with another url so we redirect to it
      if (redirectTo) {
        res.redirect(redirectTo);
        return;
      }

      if (length !== undefined) {
        res.set('Content-Length', length);
      }
      if (lastModifield !== undefined) {
        res.set('Last-Modified', lastModifield);
      }
      if (eTag !== undefined) {
        res.set('ETag', eTag);
      }
      res.set('Content-Type', mimetype);

      if (statusCode < 300) {
        res.status(statusCode);
        stream.on('error', next).pipe(res);
      } else {
        if (statusCode === 304) {
          res.status(statusCode);
          res.end();
        } else {
          res.status(statusCode);
          res.end('Unknow Error');
        }
      }
    })
  );

  // Delete an entry
  app.delete(
    `/${prefix}/:namespace/:filename`,
    errorGuard(async (req, res) => {
      const {
        params: { filename, namespace },
      } = req;

      if (!(await backend.exists(namespace, filename))) {
        res.status(404).send('Not found');
        return;
      }

      await backend.delete(namespace, filename);

      res.json({ message: 'Deleted' });
    })
  );

  return app;
};

export default fileStorage;
