
#include <trie.hpp>
#include <assert.h>

void run_trie_tests() {
    Trie<int> t;
    
    t.insert("foo", 1);
    t.insert("bar", 2);
    t.insert("foobar", 3);
    
    std::cout << "ss\n";
    assert(t.lookup("asdf") == NULL);
    assert(t.get("foo") == 1);
    assert(t.get("bar") == 2);
    assert(t.get("foobar") == 3);
}

int main() {
    run_trie_tests();
    return 0;
}
