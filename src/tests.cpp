
#include <assert.h>
#include <sstream>

#include <trie.hpp>
#include <json.hpp>

template <class Trie>
void trie_structure_json(const Trie &trie, JsonWriter &json) {
    json.begin('{');
    for(typename Trie::const_iterator c = trie.children.begin(); 
        c != trie.children.end();
        ++c)
    {
        json.key(to_string(c->first));
        trie_structure_json(c->second, json);
    }
    json.end('}');
}

template <class Trie>
std::string trie_structure_json(const Trie &trie) {
    JsonWriter json;
    trie_structure_json(trie,json);
    return json.to_string();
}

#define ASSERT_JSON_ERROR(x) try { x; assert(false); } catch(JsonWriter::error&) {}

void run_json_tests() {
    {
    JsonWriter json;
    assert(json.to_string() == string(""));
    
    json.begin('{')
        .key("foo")
        .value(2)
        .key("bar")
        .begin('[')
            .value("asdf")
            .null_value()
            
            .begin('{')
            .end('}')
        
            .value(2.5)
        .end(']')
    .end('}');
    
    assert(json.to_string() == string("{\"foo\":2,\"bar\":[\"asdf\",null,{},2.5]}"));
    }
    
    JsonWriter json;
    
    ASSERT_JSON_ERROR( json.end('}') );
    ASSERT_JSON_ERROR( json.key("foo") );
    
    json.begin('{');
    ASSERT_JSON_ERROR( json.value(1) );
    ASSERT_JSON_ERROR( json.begin('{') );
    ASSERT_JSON_ERROR( json.end(']') );
    json.key("foo");
    ASSERT_JSON_ERROR( json.key("bar") );
    json.begin('[');
    ASSERT_JSON_ERROR( json.key("baz") );
    json.value(1);
    json.end(']');
    json.end('}');
    ASSERT_JSON_ERROR( json.value(1) );
    ASSERT_JSON_ERROR( json.key("fsd") );
    ASSERT_JSON_ERROR( json.end('}') );
    ASSERT_JSON_ERROR( json.begin('[') );
    
    std::cerr << "json tests passed" << std::endl;
    
}

void run_trie_tests() {
    CharTrie t;
    StringTrie string_trie;
    
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
    
    string_trie.copy_char_trie(t);
    assert(trie_structure_json(string_trie) == "{\"ab\":{\"cd\":{},\"f\":{}}}");
    
    std::cerr << "trie tests passed" << std::endl;
}

int main() {
    run_trie_tests();
    run_json_tests();
    
    std::cerr << "all passed" << std::endl;
    return 0;
}
