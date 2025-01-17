import { mock, mockClear } from "jest-mock-extended";
import FilterInterface from "../../../src/Interfaces/FilterInterface";
import CacheInterface from "../../../src/Components/Cache/CacheInterface";
import CreatorInterface from "../../../src/Interfaces/CreatorInterface";
import ResolverSync from "../../../src/Resolver/ResolverSync";
import CacheItemInterface from "../../../src/Components/Cache/CacheItemInterface";
import { expect } from "@jest/globals";
import { ResolverEvents } from "@src/Resolver/ResolverType";
import Event from "@src/Components/EventDispatcher/Event";
import CallbackInterface from "@src/Components/EventDispatcher/Interfaces/CallbackInterface";
import DispatcherInterface from "@src/Components/EventDispatcher/Interfaces/DispatcherInterface";

describe("Resolver Sync Test", () => {
    const path = "/test/path/file.md";
    const title = "resolved_title";

    const filter = mock<FilterInterface>();
    const creator = mock<CreatorInterface>();

    const cacheItem = mock<CacheItemInterface<string>>();
    cacheItem.get.mockReturnValue(null);
    cacheItem.isHit.mockReturnValue(false);
    const cache = mock<CacheInterface>(undefined, { deep: true });
    cache.getItem.mockReturnValue(cacheItem);
    const dispatcher = mock<DispatcherInterface<ResolverEvents>>();
    let eventCallback: CallbackInterface<ResolverEvents["resolver.clear"]> = null;
    dispatcher.addListener.mockImplementation((name: string, cb) => (eventCallback = cb));
    const resolver = new ResolverSync([filter], cache, creator, dispatcher);

    afterEach(() => {
        mockClear(filter);
        mockClear(cacheItem);
        mockClear(cache);
        mockClear(creator);
    });

    describe("Test filters", () => {
        beforeAll(() => {
            cacheItem.isHit.mockReturnValue(false);
            creator.create.mockReturnValue(title);
        });

        test("Should return null because filter will return false", () => {
            filter.check.mockReturnValueOnce(false);
            expect(resolver.resolve(path)).toBeNull();
            expect(filter.check).toHaveBeenNthCalledWith(1, path);
        });
        test("Should return value because filter will return true", () => {
            filter.check.mockReturnValue(true);
            expect(resolver.resolve(path)).toEqual(title);
            expect(filter.check).toHaveBeenNthCalledWith(1, path);
        });

        afterAll(() => {
            filter.check.mockRestore();
            cacheItem.isHit.mockRestore();
            creator.create.mockRestore();
        });
    });

    describe("Test cache and creator", () => {
        beforeAll(() => {
            filter.check.mockReturnValue(true);
            creator.create.mockReturnValue(title);
        });
        test("Case when cache item is not hit", () => {
            cacheItem.isHit.mockReturnValue(false);
            expect(resolver.resolve(path)).toEqual(title);
            expect(cacheItem.set).toHaveBeenNthCalledWith(1, title);
            expect(cache.save).toHaveBeenCalledTimes(1);
            expect(cache.getItem).toHaveBeenCalledTimes(1);
            expect(creator.create).toHaveBeenNthCalledWith(1, path);
        });

        test("Cache when cache item is hit", () => {
            cacheItem.isHit.mockReturnValue(true);
            cacheItem.get.mockReturnValue(title);
            expect(resolver.resolve(path)).toEqual(title);
            expect(cacheItem.get).toHaveBeenCalledTimes(1);
            expect(creator.create).not.toHaveBeenCalled();
        });
    });

    describe("Throw exception", () => {
        const consoleError = console.error;
        const error = new Error();
        beforeAll(() => {
            cacheItem.isHit.mockReturnValueOnce(false);
            console.error = jest.fn();
        });
        test("Should not save item to cache", () => {
            creator.create.mockImplementation(() => {
                throw new Error();
                throw error;
            });
            expect(resolver.resolve("/path/to/file_exception.md")).toBeNull();
            expect(creator.create).toHaveBeenCalledTimes(1);
            expect(cache.getItem).toHaveBeenCalledTimes(1);
            expect(cacheItem.isHit).toHaveBeenCalledTimes(1);
            expect(cache.save).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.anything(), error);
        });
        afterAll(() => {
            creator.create.mockClear();
            cacheItem.isHit.mockClear();
            console.error = consoleError;
        });
    });

    describe("Test events", () => {
        beforeEach(() => {
            cache.clear.mockClear();
            cache.delete.mockClear();
            dispatcher.dispatch.mockClear();
        });
        test("Should add listener", () => {
            expect(dispatcher.addListener).toHaveBeenCalledTimes(1);
            expect(dispatcher.addListener).toHaveBeenCalledWith("resolver.clear", expect.anything());
        });
        test('Should delete one item from cache and dispatch "resolver.unresolved" with path', () => {
            const path = "/path/to/file.md";
            eventCallback.execute(new Event({ path }));
            expect(cache.delete).toHaveBeenCalledTimes(1);
            expect(cache.delete).toHaveBeenCalledWith(path);
            expect(cache.clear).not.toHaveBeenCalled();
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
            expect(dispatcher.dispatch).toHaveBeenCalledWith("resolver.unresolved", new Event({ path }));
        });

        test('Should clear cache and dispatch "resolver.unresolved" with all', () => {
            eventCallback.execute(new Event({ all: true }));
            expect(cache.clear).toHaveBeenCalledTimes(1);
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
            expect(dispatcher.dispatch).toHaveBeenCalledWith("resolver.unresolved", new Event({ all: true }));
        });
    });
});
