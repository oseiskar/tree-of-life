
#include <trie.hpp>
#include <assert.h>
#include <sstream>

std::ostream &trie_structure_json(const CharTrie &trie, std::ostream &os) {
    os << "{";
    CharTrie::const_iterator c = trie.children.begin(); 
    while (c != trie.children.end()) {
        os << '\"' << c->first << "\":";
        trie_structure_json(c->second, os);
        ++c;
        if (c != trie.children.end()) os << ",";
    }
    os << "}";
    return os;
}

std::string trie_structure_json(const CharTrie &trie) {
    std::ostringstream oss;
    trie_structure_json(trie,oss);
    return oss.str();
}

void run_trie_tests() {
    CharTrie t;
    
    std::string one("1"), two("2"), three("3");
    
    t.insert("abcd", one);
    
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}}}}}");
    assert(t.lookup("foobar") == NULL);
    assert(t.get("abcd") == one);
    
    t.insert("abf", two);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.lookup("ab") == NULL);
    
    t.insert("ab", three);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.get("ab") == three);
    
    std::cerr << "." << std::endl;
}

int main() {
    run_trie_tests();
    
    std::cerr << "passed" << std::endl;
    return 0;
}
