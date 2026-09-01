import type { Context } from '@deepseek-ai/cordis';
import type { RouteObject } from 'react-router-dom';
import { Slot, SlotOwner } from '@yunzhen/cordis-ui-renderer';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BrowserRouter, NavLink, Outlet, useRoutes } from 'react-router-dom';
import { RouteRegistry } from './routes';

export { RouteRegistry } from './routes';
export type { RouteDefinition } from './routes';

export const inject = ['slots'];

export function apply(ctx: Context) {
  const routes = new RouteRegistry(ctx);
  ctx.slots.register({ name: 'root' }, () => <RouterRoot ctx={ctx} routes={routes} />);
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main' }, RouteOutlet));
  ctx.slots.inject('sidebar', () => ctx.slots.register({
    name: 'sidebar',
    children: {
      'sidebar.navigation': { kind: 'list', scope: 'root' },
      'sidebar.footer': { kind: 'list', scope: 'root' },
    },
  }, () => <NavigationSidebar routes={routes} />));
}

function RouterRoot({ ctx, routes }: { ctx: Context; routes: RouteRegistry }) {
  return (
    <BrowserRouter>
      <RouterRoutes ctx={ctx} routes={routes} />
    </BrowserRouter>
  );
}

function RouterRoutes({ ctx, routes }: { ctx: Context; routes: RouteRegistry }) {
  const snapshot = useSyncExternalStore(routes.subscribe, routes.snapshot, routes.snapshot);
  return useRoutes(toRouteObjects(ctx, snapshot));
}

function RouteSlotOwner({ ctx, route }: { ctx: Context; route: ReturnType<RouteRegistry['snapshot']>[number] }) {
  const [owner] = useState(() => ctx.slots.createOwner(route.id, route.children ?? {}));
  useEffect(() => owner.dispose, [owner]);
  const Component = route.Component;
  return (
    <SlotOwner owner={owner}>
      <Component />
    </SlotOwner>
  );
}

function RouteOutlet() {
  return <Outlet />;
}

function NavigationSidebar({ routes }: { routes: RouteRegistry }) {
  const snapshot = useSyncExternalStore(routes.subscribe, routes.snapshot, routes.snapshot);
  const byId = new Map(snapshot.map(route => [route.id, route]));
  const links = snapshot
    .filter(route => route.navigation)
    .sort((left, right) => left.navigation!.order - right.navigation!.order);

  return (
    <>
      <nav>
        {links.map(route => (
          <NavLink key={route.id} to={routeHref(route, byId)}>{route.navigation!.label}</NavLink>
        ))}
        <Slot name="sidebar.navigation" />
      </nav>
      <footer><Slot name="sidebar.footer" /></footer>
    </>
  );
}

function toRouteObjects(ctx: Context, routes: ReturnType<RouteRegistry['snapshot']>): RouteObject[] {
  const children = new Map<string | undefined, typeof routes>();
  for (const route of routes)
    children.set(route.parentId, [...children.get(route.parentId) ?? [], route]);

  const build = (route: typeof routes[number]): RouteObject => {
    const element = <RouteSlotOwner key={route.id} ctx={ctx} route={route} />;
    if (route.index)
      return { id: route.id, index: true, element };
    return {
      id: route.id,
      path: route.path,
      element,
      children: children.get(route.id)?.map(build),
    };
  };

  return children.get(undefined)?.map(build) ?? [];
}

function routeHref(
  route: ReturnType<RouteRegistry['snapshot']>[number],
  byId: Map<string, ReturnType<RouteRegistry['snapshot']>[number]>,
) {
  const paths: string[] = [];
  let current: ReturnType<RouteRegistry['snapshot']>[number] | undefined = route;
  while (current) {
    if (current.path)
      paths.unshift(current.path);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return `/${paths.join('/')}`;
}
