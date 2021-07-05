import * as process from 'process';
import * as fs from 'fs/promises';

type PkgGraph = Map<Package, Array<string>>;

type State = {
  root: Package;
  graph: PkgGraph;
  packageMap: {
    [key: string]: Package;
  };
};

type PackageJson = {
  name: string;
  dependencies: {
    [key: string]: string;
  };
}

type Package = {
  json: PackageJson;
  path: string;
}

const copyPackageJson = (p: string) => fs.copyFile(`${p}/package.json`, `${p}/.package.json.bak`);

async function backupFiles(packageJsonCopier: ((p: string) => Promise<void>), paths: string[]) {
  const promises = paths.map(packageJsonCopier);
  await Promise.all(promises);
}

function buildDepGraph(packageJsons: Array<PackageJson>, allPackages: Array<string>, root: string): State {
  const addPackageForDep = (acc: { [key: string]: Package }, p: string, idx: number) => ({
    ...acc,
    [packageJsons[idx].name]: {
      json: packageJsons[idx],
      path: p
    }
  });
  const packageMap: { [key: string]: Package } = allPackages.reduce(addPackageForDep, {});
  console.log({packageMap});
  const rootPackage = packageMap[root];

  const depsForPackage = (pkg: Package) => {
    return Object.keys(pkg.json.dependencies).filter(d => packageMap[d] ?? false);
  };

  const walkPackageGraph = (g: PkgGraph, current: Package): PkgGraph => {
    const deps = depsForPackage(current);
    return deps.reduce((acc, d) => {
      const pkg = packageMap[d];
      const pkgDeps = acc.get(pkg) ?? [];
      console.log(`Adding ${current.json.name} as a dependent of ${pkg.json.name}`);
      acc.set(pkg, [...pkgDeps, current.json.name]);
      return walkPackageGraph(acc, pkg);
    }, g);
  };

  return {
    root: rootPackage,
    graph: walkPackageGraph(new Map(), packageMap[root]),
    packageMap
  };
}

const readPackageJson = (p: string) => fs.readFile(`${p}/package.json`)

export async function setupState([root, ...deps]: string[], packageJsonReader: ((p: string) => Promise<Buffer>), packageJsonCopier: ((p: string) => Promise<void>)): Promise<State> {
  if (!root) {
    console.error('Please supply a root as the first argument');
    process.exit(1);
  }


  const promises = [root, ...deps].map(packageJsonReader);
  const buffers = await Promise.all(promises);
  const packageJsons: Array<PackageJson> = buffers.map(b => JSON.parse(b.toString()));
  const allPackageNames = packageJsons.map(p => p.name);
  const [rootPackageJson] = packageJsons;
  await backupFiles(packageJsonCopier, [root, ...deps]);
  return buildDepGraph(packageJsons, allPackageNames, rootPackageJson.name);
}

async function watchPackages(state: State): Promise<void> {
  console.log(state);
  await null;
}



(async () => {
  const state = await setupState(process.argv.slice(2), readPackageJson, copyPackageJson);
  await watchPackages(state);
})();