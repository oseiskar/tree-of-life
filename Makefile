CFLAGS=-O3 -Wall -Wextra -pedantic -Iinclude/
CC=g++

SOURCE_FILES = include/tree.hpp include/trie.hpp include/json.hpp include/utf8.hpp

.PHONY: clean jsons test

jsons: clean bin/main data/source.tre
	bin/main < data/source.tre
	
test: bin/tests
	bin/tests
	
bin/main: src/main.cpp $(SOURCE_FILES)
	$(CC) src/main.cpp $(CFLAGS) -o bin/main
	
bin/tests: src/tests.cpp $(SOURCE_FILES)
	$(CC) src/tests.cpp $(CFLAGS) -o bin/tests
	
clean:
	rm -f bin/main bin/test
	rm -f data/*.json
